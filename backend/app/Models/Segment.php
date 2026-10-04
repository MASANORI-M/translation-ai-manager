<?php

namespace App\Models;

use Database\Factories\SegmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['script_id', 'sequence', 'timecode_start_ms', 'timecode_end_ms', 'emotion_direction', 'source_text', 'source_version', 'ai_translation', 'ai_generation_id', 'ai_source_version', 'final_translation', 'final_source_version', 'memo', 'status', 'version'])]
class Segment extends Model {
    /** @use HasFactory<SegmentFactory> */
    use HasFactory, SoftDeletes;

    public const STATUSES = ['pending', 'editing', 'completed'];

    protected $attributes = ['source_version' => 1, 'version' => 1, 'status' => 'pending'];

    protected function casts(): array {
        return ['sequence' => 'integer', 'timecode_start_ms' => 'integer', 'timecode_end_ms' => 'integer', 'source_version' => 'integer', 'ai_generation_id' => 'integer', 'ai_source_version' => 'integer', 'final_source_version' => 'integer', 'version' => 'integer'];
    }

    public function script(): BelongsTo {
        return $this->belongsTo(Script::class);
    }

    public function aiGeneration(): BelongsTo {
        return $this->belongsTo(AiGeneration::class);
    }
}
