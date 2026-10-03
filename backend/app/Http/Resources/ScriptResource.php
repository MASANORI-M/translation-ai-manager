<?php

namespace App\Http\Resources;

use App\Services\EstimatedPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScriptResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'project_id' => $this->project_id, 'title' => $this->title,
            'word_count' => $this->word_count, 'deadline' => $this->deadline?->format('Y-m-d'),
            'status' => $this->status, 'started_at' => $this->started_at, 'completed_at' => $this->completed_at,
            'rate_type' => $this->rate_type, 'rate' => $this->rate, 'currency' => $this->currency,
            'progress' => [
                'completed' => $this->completed_segments_count ?? $this->segments()->where('status', 'completed')->count(),
                'total' => $this->segments_count ?? $this->segments()->count(),
            ],
            'estimated_payment' => app(EstimatedPayment::class)->calculate($this->resource),
            'created_at' => $this->created_at, 'updated_at' => $this->updated_at,
        ];
    }
}
