<?php

namespace App\Repositories;

use App\Models\Script;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class ScriptRepository {
    public function paginate(int $projectId): LengthAwarePaginator {
        return Script::query()->where('project_id', $projectId)->withCount(['segments', 'segments as completed_segments_count' => fn ($query) => $query->where('status', 'completed')])->orderByDesc('id')->paginate(20);
    }

    public function find(int $projectId, int $id): Script {
        return Script::query()->where('project_id', $projectId)->withCount(['segments', 'segments as completed_segments_count' => fn ($query) => $query->where('status', 'completed')])->findOrFail($id);
    }

    public function findForUpdate(int $projectId, int $id): Script {
        return Script::query()->where('project_id', $projectId)->lockForUpdate()->findOrFail($id);
    }

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Script {
        return Script::query()->create($attributes)->loadCount(['segments', 'segments as completed_segments_count' => fn ($query) => $query->where('status', 'completed')]);
    }

    /** @param array<string, mixed> $attributes */
    public function update(Script $script, array $attributes): Script {
        $script->update($attributes);

        return $script->loadCount(['segments', 'segments as completed_segments_count' => fn ($query) => $query->where('status', 'completed')]);
    }

    public function delete(Script $script): void {
        DB::transaction(function () use ($script): void {
            $script->segments()->delete();
            $script->delete();
        });
    }
}
