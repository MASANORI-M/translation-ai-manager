<?php

namespace App\Models;

use Database\Factories\AiGenerationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['segment_id', 'model', 'model_name', 'resolved_model', 'provider_response_id', 'instruction', 'source_text_snapshot', 'source_version_snapshot', 'output', 'input_tokens', 'output_tokens', 'total_tokens', 'cached_input_tokens', 'cache_write_tokens', 'usage_details', 'pricing_snapshot', 'request_settings_snapshot', 'glossary_snapshot', 'segment_context_snapshot', 'cost_status', 'input_cost', 'output_cost', 'total_cost', 'selected'])]
class AiGeneration extends Model {
    /** @use HasFactory<AiGenerationFactory> */
    use HasFactory;

    protected $attributes = ['selected' => false];

    protected function casts(): array {
        return [
            'source_version_snapshot' => 'integer',
            'input_tokens' => 'integer', 'output_tokens' => 'integer', 'total_tokens' => 'integer',
            'cached_input_tokens' => 'integer', 'cache_write_tokens' => 'integer',
            'selected' => 'boolean', 'usage_details' => 'array', 'pricing_snapshot' => 'array', 'request_settings_snapshot' => 'array',
            'glossary_snapshot' => 'array',
            'segment_context_snapshot' => 'array',
            'input_cost' => 'decimal:10', 'output_cost' => 'decimal:10', 'total_cost' => 'decimal:10',
        ];
    }

    public function segment(): BelongsTo {
        return $this->belongsTo(Segment::class);
    }
}
