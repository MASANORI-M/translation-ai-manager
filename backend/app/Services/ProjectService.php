<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Repositories\ProjectRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Gate;

class ProjectService
{
    public function __construct(private ProjectRepository $projects) {}

    public function list(User $user, bool $includeArchived): LengthAwarePaginator
    {
        Gate::forUser($user)->authorize('viewAny', Project::class);

        return $this->projects->paginateForUser($user->id, $includeArchived);
    }

    /** @param array<string, mixed> $attributes */
    public function create(User $user, array $attributes): Project
    {
        Gate::forUser($user)->authorize('create', Project::class);

        return $this->projects->create([...$attributes, 'user_id' => $user->id]);
    }

    public function show(User $user, int $id): Project
    {
        $project = $this->projects->find($id);
        Gate::forUser($user)->authorize('view', $project);

        return $project;
    }

    /** @param array<string, mixed> $attributes */
    public function update(User $user, int $id, array $attributes): Project
    {
        $project = $this->projects->find($id);
        Gate::forUser($user)->authorize('update', $project);

        return $this->projects->update($project, $attributes);
    }

    public function delete(User $user, int $id): void
    {
        $project = $this->projects->find($id);
        Gate::forUser($user)->authorize('delete', $project);
        $this->projects->delete($project);
    }
}
