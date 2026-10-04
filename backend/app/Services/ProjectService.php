<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Repositories\AiGenerationRepository;
use App\Repositories\ProjectRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Gate;

class ProjectService {
    public function __construct(private ProjectRepository $projects, private AiGenerationRepository $generations) {}

    public function list(User $user, bool $includeArchived): LengthAwarePaginator {
        Gate::forUser($user)->authorize('viewAny', Project::class);

        return $this->projects->paginateForUser($user->id, $includeArchived);
    }

    /** @param array<string, mixed> $attributes */
    public function create(User $user, array $attributes): Project {
        Gate::forUser($user)->authorize('create', Project::class);

        return $this->projects->create([...$attributes, 'user_id' => $user->id]);
    }

    public function show(User $user, int $id): Project {
        $project = $this->projects->find($id);
        Gate::forUser($user)->authorize('view', $project);

        return $project;
    }

    public function showWithApiUsage(User $user, int $id): Project {
        $project = $this->show($user, $id);
        $totals = [];
        $unknownCount = 0;
        foreach ($this->generations->costsForProject($id) as $generation) {
            $currency = $generation->pricing_snapshot['currency'] ?? null;
            if ($generation->cost_status !== 'calculated' || $generation->total_cost === null || ! is_string($currency) || $currency === '') {
                $unknownCount++;

                continue;
            }
            $totals[$currency] = bcadd($totals[$currency] ?? '0', $generation->total_cost, 10);
        }
        if ($totals === [] && $unknownCount === 0) {
            $totals[config('ai.currency')] = '0.0000000000';
        }
        ksort($totals);
        $amounts = [];
        foreach ($totals as $currency => $total) {
            $yenCost = $currency === 'USD' && $project->usd_jpy_rate !== null
                ? bcadd(bcmul($total, $project->usd_jpy_rate, 16), '0.005', 2)
                : null;
            $amounts[] = ['currency' => $currency, 'total_cost' => $total, 'jpy_cost' => $yenCost];
        }
        $project->setAttribute('api_usage_cost', ['totals' => $amounts, 'unknown_count' => $unknownCount]);

        return $project;
    }

    /** @param array<string, mixed> $attributes */
    public function update(User $user, int $id, array $attributes): Project {
        $project = $this->projects->find($id);
        Gate::forUser($user)->authorize('update', $project);

        return $this->projects->update($project, $attributes);
    }

    public function delete(User $user, int $id): void {
        $project = $this->projects->find($id);
        Gate::forUser($user)->authorize('delete', $project);
        $this->projects->delete($project);
    }
}
