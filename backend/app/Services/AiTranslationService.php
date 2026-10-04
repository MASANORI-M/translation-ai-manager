<?php

namespace App\Services;

use App\Models\Segment;
use App\Models\User;
use App\Repositories\AiGenerationRepository;
use App\Repositories\ScriptRepository;
use App\Repositories\SegmentRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AiTranslationService {
    public function __construct(
        private SegmentService $segmentService,
        private SegmentRepository $segments,
        private ScriptRepository $scripts,
        private ProjectService $projects,
        private AiGenerationRepository $generations,
        private AiModelCatalog $models,
        private TranslationPromptBuilder $prompts,
        private OpenAIService $openai,
        private AiCostCalculator $costs,
        private GlossaryService $glossaries,
    ) {}

    /** @return array<string, mixed> */
    public function generate(User $user, int $projectId, int $scriptId, int $segmentId, string $modelId, ?int $version): array {
        $segment = $this->segmentService->show($user, $projectId, $scriptId, $segmentId);
        $model = $this->models->get($modelId);
        $this->ensureVersion($segment, $version);
        $lock = Cache::lock('ai-translate:'.$segmentId, config('ai.timeout') + 30);
        if (! $lock->get()) {
            throw ValidationException::withMessages(['ai_translation' => 'このSegmentはAI翻訳を生成中です。完了するまでお待ちください。']);
        }
        try {
            $adjacent = $this->segments->adjacent($scriptId, $segment->sequence);
            $context = [
                'previous' => $this->contextSegment($adjacent['previous']),
                'current' => ['sequence' => $segment->sequence],
                'next' => $this->contextSegment($adjacent['next']),
                'recent_final_translations' => $this->recentFinalTranslations($scriptId, $segment->sequence),
            ];
            $glossary = $this->glossaries->matching($projectId, $segment->source_text);
            $instruction = $this->prompts->build($this->projects->show($user, $projectId), $segment, $glossary, $context);
            $pricing = $this->costs->snapshot($model);
            $settings = [
                'model' => $modelId, 'reasoning' => ['effort' => $model['reasoning_effort']],
                'max_output_tokens' => config('ai.max_output_tokens'), 'service_tier' => config('ai.service_tier'),
            ];
            $result = $this->openai->translate($instruction, $settings);
            $usage = $result['usage'];
            $pricing['resolved_service_tier'] = $result['service_tier'];
            $cost = $this->costs->calculate($usage, $pricing);

            return DB::transaction(function () use ($user, $projectId, $scriptId, $segmentId, $segment, $modelId, $model, $instruction, $pricing, $settings, $result, $usage, $cost, $glossary, $context): array {
                $this->segmentService->show($user, $projectId, $scriptId, $segmentId);
                $this->scripts->findForUpdate($projectId, $scriptId);
                $current = $this->segments->findForUpdate($scriptId, $segmentId);
                $generation = $this->generations->create([
                    'segment_id' => $segmentId, 'model' => $modelId, 'model_name' => $model['name'],
                    'resolved_model' => $result['resolved_model'], 'provider_response_id' => $result['provider_response_id'],
                    'instruction' => $instruction, 'source_text_snapshot' => $segment->source_text,
                    'source_version_snapshot' => $segment->source_version, 'output' => $result['output'],
                    'input_tokens' => $usage['input_tokens'], 'output_tokens' => $usage['output_tokens'], 'total_tokens' => $usage['total_tokens'],
                    'cached_input_tokens' => data_get($usage, 'input_tokens_details.cached_tokens'),
                    'cache_write_tokens' => data_get($usage, 'input_tokens_details.cache_write_tokens'),
                    'usage_details' => $usage, 'pricing_snapshot' => $pricing, 'request_settings_snapshot' => $settings,
                    'glossary_snapshot' => $glossary,
                    'segment_context_snapshot' => $context,
                    ...$cost,
                ]);
                $applied = $current->source_version === $segment->source_version;
                if ($applied) {
                    $current = $this->segments->update($current, [
                        'ai_translation' => $result['output'], 'ai_generation_id' => $generation->id,
                        'ai_source_version' => $segment->source_version, 'version' => $current->version + 1,
                    ]);
                }

                return ['translation' => $result['output'], 'generation' => $generation, 'segment' => $current, 'applied' => $applied];
            });
        } finally {
            $lock->release();
        }
    }

    public function history(User $user, int $projectId, int $scriptId, int $segmentId): LengthAwarePaginator {
        $this->segmentService->show($user, $projectId, $scriptId, $segmentId);

        return $this->generations->paginate($segmentId);
    }

    public function select(User $user, int $projectId, int $scriptId, int $segmentId, int $generationId, int $version): Segment {
        $this->segmentService->show($user, $projectId, $scriptId, $segmentId);

        return DB::transaction(function () use ($projectId, $scriptId, $segmentId, $generationId, $version): Segment {
            $this->scripts->findForUpdate($projectId, $scriptId);
            $segment = $this->segments->findForUpdate($scriptId, $segmentId);
            $this->ensureVersion($segment, $version);
            $generation = $this->generations->find($segmentId, $generationId);
            if ($generation->source_version_snapshot !== $segment->source_version) {
                throw ValidationException::withMessages(['generation' => '原文・演出が変更された古い候補は採用できません。AI翻訳を再生成してください。']);
            }
            $this->generations->select($generation);

            return $this->segments->update($segment, [
                'final_translation' => $generation->output, 'final_source_version' => $segment->source_version,
                'status' => 'editing', 'version' => $segment->version + 1,
            ]);
        });
    }

    /** @return array{id: int, sequence: int, source_text: string, source_version: int}|null */
    private function contextSegment(?Segment $segment): ?array {
        return $segment === null ? null : $segment->only(['id', 'sequence', 'source_text', 'source_version']);
    }

    /** @return list<array{id: int, sequence: int, source_text: string, final_translation: string}> */
    private function recentFinalTranslations(int $scriptId, int $sequence): array {
        return $this->segments->finalTranslationCandidatesBefore($scriptId, $sequence)
            ->filter(fn (Segment $segment): bool => trim($segment->final_translation) !== '')
            ->take(3)->collect()->reverse()->values()
            ->map(fn (Segment $segment): array => $segment->only(['id', 'sequence', 'source_text', 'final_translation']))
            ->all();
    }

    private function ensureVersion(Segment $segment, ?int $version): void {
        if ($version !== null && $segment->version !== $version) {
            throw ValidationException::withMessages(['version' => 'このSegmentは別の操作で更新されました。再読み込みして確認してください。']);
        }
    }
}
