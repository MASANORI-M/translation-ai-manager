<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GlossaryResource extends JsonResource {
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array {
        return [
            'id' => $this->id, 'project_id' => $this->project_id,
            'source_term' => $this->source_term, 'target_term' => $this->target_term, 'note' => $this->note,
            'created_at' => $this->created_at, 'updated_at' => $this->updated_at,
        ];
    }
}
