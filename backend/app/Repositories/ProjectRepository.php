<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\Segment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ProjectRepository
{
    public function paginateForUser(int $userId, bool $includeArchived): LengthAwarePaginator
    {
        return Project::query()->where('user_id', $userId)
            ->when(! $includeArchived, fn (Builder $query): Builder => $query->where('status', '!=', 'archived'))
            ->orderByDesc('id')->paginate(20);
    }

    public function find(int $id): Project
    {
        return Project::query()->findOrFail($id);
    }

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Project
    {
        return Project::query()->create($attributes);
    }

    /** @param array<string, mixed> $attributes */
    public function update(Project $project, array $attributes): Project
    {
        $project->update($attributes);

        return $project;
    }

    public function delete(Project $project): void
    {
        DB::transaction(function () use ($project): void {
            Segment::query()->whereIn('script_id', $project->scripts()->select('id'))->delete();
            $project->scripts()->delete();
            $project->delete();
        });
    }
}
