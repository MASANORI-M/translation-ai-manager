<?php

namespace App\Services;

use App\Models\Script;
use App\Models\User;
use App\Repositories\ScriptRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ScriptService {
    public function __construct(private ScriptRepository $scripts, private ProjectService $projects) {}

    public function list(User $user, int $projectId): LengthAwarePaginator {
        $this->projects->show($user, $projectId);

        return $this->scripts->paginate($projectId);
    }

    public function show(User $user, int $projectId, int $id): Script {
        $this->projects->show($user, $projectId);

        return $this->scripts->find($projectId, $id);
    }

    /** @param array<string, mixed> $attributes */
    public function create(User $user, int $projectId, array $attributes): Script {
        $project = $this->projects->show($user, $projectId);

        return $this->scripts->create([...$this->timestamps($attributes), 'project_id' => $project->id, 'rate_type' => $project->rate_type, 'rate' => $project->rate, 'currency' => $project->currency]);
    }

    /** @param array<string, mixed> $attributes */
    public function update(User $user, int $projectId, int $id, array $attributes): Script {
        $script = $this->show($user, $projectId, $id);

        if ($script->segments_count > 0) {
            $attributes['word_count'] = $script->word_count;
        }

        return $this->scripts->update($script, $this->timestamps($attributes, $script));
    }

    public function delete(User $user, int $projectId, int $id): void {
        $this->scripts->delete($this->show($user, $projectId, $id));
    }

    /** @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    private function timestamps(array $attributes, ?Script $script = null): array {
        if ($attributes['status'] === 'in_progress' && ! ($attributes['started_at'] ?? $script?->started_at)) {
            $attributes['started_at'] = now();
        }
        if ($attributes['status'] === 'completed') {
            $attributes['completed_at'] = $attributes['completed_at'] ?? ($script?->status === 'completed' ? $script->completed_at : null) ?? now();
        } else {
            $attributes['completed_at'] = null;
        }

        return $attributes;
    }
}
