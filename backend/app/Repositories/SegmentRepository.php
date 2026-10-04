<?php

namespace App\Repositories;

use App\Models\Segment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\LazyCollection;

class SegmentRepository {
    public function paginate(int $scriptId): LengthAwarePaginator {
        return Segment::query()->with('aiGeneration')->where('script_id', $scriptId)->orderBy('sequence')->paginate(20);
    }

    public function find(int $scriptId, int $id): Segment {
        return Segment::query()->with('aiGeneration')->where('script_id', $scriptId)->findOrFail($id);
    }

    public function findForUpdate(int $scriptId, int $id): Segment {
        return Segment::query()->where('script_id', $scriptId)->lockForUpdate()->findOrFail($id);
    }

    /** @return array{previous: ?Segment, next: ?Segment} */
    public function adjacent(int $scriptId, int $sequence): array {
        return [
            'previous' => Segment::query()->where('script_id', $scriptId)->where('sequence', '<', $sequence)->orderByDesc('sequence')->first(),
            'next' => Segment::query()->where('script_id', $scriptId)->where('sequence', '>', $sequence)->orderBy('sequence')->first(),
        ];
    }

    /** @return LazyCollection<int, Segment> */
    public function finalTranslationCandidatesBefore(int $scriptId, int $sequence): LazyCollection {
        return Segment::query()->where('script_id', $scriptId)->where('sequence', '<', $sequence)
            ->whereNotNull('final_translation')->where('final_translation', '!=', '')
            ->orderByDesc('sequence')->cursor();
    }

    public function sequenceExists(int $scriptId, int $sequence, ?int $exceptId = null): bool {
        return Segment::withTrashed()->where('script_id', $scriptId)->where('sequence', $sequence)
            ->when($exceptId, fn ($query) => $query->whereKeyNot($exceptId))->exists();
    }

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Segment {
        return Segment::query()->create($attributes);
    }

    /** @param array<string, mixed> $attributes */
    public function update(Segment $segment, array $attributes): Segment {
        $segment->update($attributes);

        return $segment->load('aiGeneration');
    }

    public function delete(Segment $segment): void {
        $segment->delete();
    }

    /** @return list<string> */
    public function sourceTexts(int $scriptId): array {
        return Segment::query()->where('script_id', $scriptId)->pluck('source_text')->all();
    }
}
