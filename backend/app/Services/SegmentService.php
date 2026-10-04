<?php

namespace App\Services;

use App\Models\Script;
use App\Models\Segment;
use App\Models\User;
use App\Repositories\ScriptRepository;
use App\Repositories\SegmentRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SegmentService {
    public function __construct(private SegmentRepository $segments, private ScriptService $scripts, private ScriptRepository $scriptRepository) {}

    public function list(User $user, int $projectId, int $scriptId): LengthAwarePaginator {
        $this->scripts->show($user, $projectId, $scriptId);

        return $this->segments->paginate($scriptId);
    }

    public function show(User $user, int $projectId, int $scriptId, int $id): Segment {
        $this->scripts->show($user, $projectId, $scriptId);

        return $this->segments->find($scriptId, $id);
    }

    /** @param array<string, mixed> $attributes */
    public function create(User $user, int $projectId, int $scriptId, array $attributes): Segment {
        $this->scripts->show($user, $projectId, $scriptId);

        return DB::transaction(function () use ($projectId, $scriptId, $attributes): Segment {
            $script = $this->scriptRepository->findForUpdate($projectId, $scriptId);
            $this->ensureAvailableSequence($scriptId, $attributes['sequence']);
            $values = $this->mapAttributes($attributes);
            $values['script_id'] = $scriptId;
            $values['final_source_version'] = $this->hasTranslation($values['final_translation']) ? 1 : null;
            $segment = $this->segments->create($values);
            $this->recountWords($script);

            return $segment;
        });
    }

    /** @param array<string, mixed> $attributes */
    public function update(User $user, int $projectId, int $scriptId, int $id, array $attributes): Segment {
        $this->scripts->show($user, $projectId, $scriptId);

        return DB::transaction(function () use ($projectId, $scriptId, $id, $attributes): Segment {
            $script = $this->scriptRepository->findForUpdate($projectId, $scriptId);
            $segment = $this->segments->findForUpdate($scriptId, $id);
            if ($segment->version !== $attributes['version']) {
                throw ValidationException::withMessages(['version' => 'このSegmentは別の操作で更新されました。再読み込みして確認してください。']);
            }
            if ($segment->sequence !== $attributes['sequence']) {
                $this->ensureAvailableSequence($scriptId, $attributes['sequence'], $id);
            }
            $values = $this->mapAttributes($attributes);
            $sourceChanged = $segment->source_text !== $values['source_text']
                || $segment->emotion_direction !== $values['emotion_direction']
                || $segment->timecode_start_ms !== $values['timecode_start_ms']
                || $segment->timecode_end_ms !== $values['timecode_end_ms'];
            $values['source_version'] = $segment->source_version + ($sourceChanged ? 1 : 0);
            $translationChanged = $segment->final_translation !== $values['final_translation'];
            if (! $this->hasTranslation($values['final_translation'])) {
                $values['final_source_version'] = null;
            } elseif ($translationChanged || (! $sourceChanged && ($attributes['status'] === 'completed' || $segment->final_source_version !== $segment->source_version))) {
                $values['final_source_version'] = $values['source_version'];
            } else {
                $values['final_source_version'] = $segment->final_source_version;
            }
            if ($sourceChanged && ! $translationChanged && $values['status'] === 'completed') {
                $values['status'] = 'editing';
            }
            $values['version'] = $segment->version + 1;
            $segment = $this->segments->update($segment, $values);
            if ($sourceChanged) {
                $this->recountWords($script);
            }

            return $segment;
        });
    }

    public function delete(User $user, int $projectId, int $scriptId, int $id): void {
        $this->scripts->show($user, $projectId, $scriptId);
        DB::transaction(function () use ($projectId, $scriptId, $id): void {
            $script = $this->scriptRepository->findForUpdate($projectId, $scriptId);
            $this->segments->delete($this->segments->findForUpdate($scriptId, $id));
            $this->recountWords($script);
        });
    }

    /** @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    private function mapAttributes(array $attributes): array {
        unset($attributes['version']);
        $attributes['timecode_start_ms'] = $this->milliseconds($attributes['timecode_start'] ?? null);
        $attributes['timecode_end_ms'] = $this->milliseconds($attributes['timecode_end'] ?? null);
        $attributes['emotion_direction'] = $attributes['emotion'] ?? null;
        $attributes['final_translation'] = $attributes['final_translation'] ?? null;
        $attributes['memo'] = $attributes['memo'] ?? null;
        unset($attributes['timecode_start'], $attributes['timecode_end'], $attributes['emotion']);

        return $attributes;
    }

    private function milliseconds(?string $timecode): ?int {
        if ($timecode === null) {
            return null;
        }
        $parts = explode(':', $timecode);
        $seconds = (float) array_pop($parts);
        $minutes = (int) array_pop($parts);
        $hours = (int) ($parts[0] ?? 0);

        return (int) round((($hours * 3600) + ($minutes * 60) + $seconds) * 1000);
    }

    private function ensureAvailableSequence(int $scriptId, int $sequence, ?int $exceptId = null): void {
        if ($this->segments->sequenceExists($scriptId, $sequence, $exceptId)) {
            throw ValidationException::withMessages(['sequence' => 'このScript内で使用済みのSequenceです。']);
        }
    }

    private function hasTranslation(?string $translation): bool {
        return $translation !== null && trim($translation) !== '';
    }

    private function recountWords(Script $script): void {
        $count = 0;
        foreach ($this->segments->sourceTexts($script->id) as $sourceText) {
            foreach (preg_split('/\s+/u', trim($sourceText)) ?: [] as $token) {
                if (preg_match('/[A-Za-z0-9]/', $token)) {
                    $count++;
                }
            }
        }
        $this->scriptRepository->update($script, ['word_count' => $count]);
    }
}
