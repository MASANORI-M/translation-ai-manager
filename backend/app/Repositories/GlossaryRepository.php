<?php

namespace App\Repositories;

use App\Models\Glossary;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\LazyCollection;

class GlossaryRepository {
    public function paginate(int $projectId): LengthAwarePaginator {
        return Glossary::query()->where('project_id', $projectId)->orderByDesc('id')->paginate(20);
    }

    /** @return LazyCollection<int, Glossary> */
    public function allForProject(int $projectId): LazyCollection {
        return Glossary::query()->where('project_id', $projectId)->orderBy('id')->cursor();
    }

    public function find(int $projectId, int $id): Glossary {
        return Glossary::query()->where('project_id', $projectId)->findOrFail($id);
    }

    public function sourceTermExists(int $projectId, string $key, ?int $exceptId = null): bool {
        return Glossary::query()->where('project_id', $projectId)->where('source_term_key', $key)
            ->when($exceptId !== null, fn ($query) => $query->where('id', '!=', $exceptId))->exists();
    }

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Glossary {
        return Glossary::query()->create($attributes);
    }

    /** @param array<string, mixed> $attributes */
    public function update(Glossary $glossary, array $attributes): Glossary {
        $glossary->update($attributes);

        return $glossary;
    }

    public function delete(Glossary $glossary): void {
        $glossary->delete();
    }
}
