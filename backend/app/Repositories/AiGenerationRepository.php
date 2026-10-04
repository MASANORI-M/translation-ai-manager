<?php

namespace App\Repositories;

use App\Models\AiGeneration;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\LazyCollection;

class AiGenerationRepository {
    /** @return LazyCollection<int, AiGeneration> */
    public function costsForProject(int $projectId): LazyCollection {
        return AiGeneration::query()
            ->join('segments', 'segments.id', '=', 'ai_generations.segment_id')
            ->join('scripts', 'scripts.id', '=', 'segments.script_id')
            ->where('scripts.project_id', $projectId)
            ->select(['ai_generations.total_cost', 'ai_generations.cost_status', 'ai_generations.pricing_snapshot'])
            ->cursor();
    }

    public function paginate(int $segmentId): LengthAwarePaginator {
        return AiGeneration::query()->where('segment_id', $segmentId)->orderByDesc('id')->paginate(10);
    }

    public function find(int $segmentId, int $id): AiGeneration {
        return AiGeneration::query()->where('segment_id', $segmentId)->findOrFail($id);
    }

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): AiGeneration {
        return AiGeneration::query()->create($attributes);
    }

    public function select(AiGeneration $generation): void {
        AiGeneration::query()->where('segment_id', $generation->segment_id)->whereKeyNot($generation->id)->where('selected', true)->update(['selected' => false]);
        $generation->update(['selected' => true]);
    }
}
