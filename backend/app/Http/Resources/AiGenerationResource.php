<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AiGenerationResource extends JsonResource {
    /** @return array<string, mixed> */
    public function toArray(Request $request): array {
        return [
            'id' => $this->id, 'segment_id' => $this->segment_id, 'model' => $this->model, 'model_name' => $this->model_name,
            'resolved_model' => $this->resolved_model, 'instruction' => $this->instruction, 'output' => $this->output,
            'source_version_snapshot' => $this->source_version_snapshot,
            'source_text_snapshot' => $this->source_text_snapshot,
            'glossary_snapshot' => $this->glossary_snapshot,
            'segment_context_snapshot' => $this->segmentContextSnapshot(),
            'input_tokens' => $this->input_tokens, 'output_tokens' => $this->output_tokens, 'total_tokens' => $this->total_tokens,
            'cached_input_tokens' => $this->cached_input_tokens, 'cache_write_tokens' => $this->cache_write_tokens,
            'pricing_snapshot' => $this->pricing_snapshot, 'cost_status' => $this->cost_status,
            'input_cost' => $this->input_cost, 'output_cost' => $this->output_cost, 'total_cost' => $this->total_cost,
            'selected' => $this->selected, 'created_at' => $this->created_at, 'updated_at' => $this->updated_at,
        ];
    }

    /** @return array<string, mixed>|null */
    private function segmentContextSnapshot(): ?array {
        $context = $this->segment_context_snapshot;
        if ($context === null) {
            return null;
        }

        return [...$context, 'current' => [
            ...$context['current'],
            'id' => $this->segment_id,
            'source_text' => $this->source_text_snapshot,
            'source_version' => $this->source_version_snapshot,
        ]];
    }
}
