<?php

namespace App\Services;

use App\Models\Glossary;
use App\Models\User;
use App\Repositories\GlossaryRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

class GlossaryService {
    public function __construct(private GlossaryRepository $glossaries, private ProjectService $projects) {}

    public function list(User $user, int $projectId): LengthAwarePaginator {
        $this->projects->show($user, $projectId);

        return $this->glossaries->paginate($projectId);
    }

    /** @param array<string, mixed> $attributes */
    public function create(User $user, int $projectId, array $attributes): Glossary {
        $this->projects->show($user, $projectId);
        $values = $this->attributes($attributes);
        $this->ensureUnique($projectId, $values['source_term_key']);
        try {
            return $this->glossaries->create([...$values, 'project_id' => $projectId]);
        } catch (UniqueConstraintViolationException) {
            $this->duplicate();
        }
    }

    /** @param array<string, mixed> $attributes */
    public function update(User $user, int $projectId, int $id, array $attributes): Glossary {
        $this->projects->show($user, $projectId);
        $glossary = $this->glossaries->find($projectId, $id);
        $values = $this->attributes($attributes);
        $this->ensureUnique($projectId, $values['source_term_key'], $id);
        try {
            return $this->glossaries->update($glossary, $values);
        } catch (UniqueConstraintViolationException) {
            $this->duplicate();
        }
    }

    public function delete(User $user, int $projectId, int $id): void {
        $this->projects->show($user, $projectId);
        $this->glossaries->delete($this->glossaries->find($projectId, $id));
    }

    /** @return list<array{id: int, source_term: string, target_term: string, note: ?string}> */
    public function matching(int $projectId, string $source): array {
        $matched = [];
        foreach ($this->glossaries->allForProject($projectId) as $glossary) {
            if (mb_stripos($source, $glossary->source_term, 0, 'UTF-8') !== false) {
                $matched[] = ['id' => $glossary->id, 'source_term' => $glossary->source_term, 'target_term' => $glossary->target_term, 'note' => $glossary->note];
            }
        }

        return $matched;
    }

    /** @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    private function attributes(array $attributes): array {
        return [...$attributes, 'note' => $attributes['note'] ?? null, 'source_term_key' => hash('sha256', mb_strtolower(trim($attributes['source_term']), 'UTF-8'))];
    }

    private function ensureUnique(int $projectId, string $key, ?int $exceptId = null): void {
        if ($this->glossaries->sourceTermExists($projectId, $key, $exceptId)) {
            $this->duplicate();
        }
    }

    private function duplicate(): never {
        throw ValidationException::withMessages(['source_term' => 'このProjectには同じSource Termが登録されています。']);
    }
}
