<?php

namespace App\Models;

use Database\Factories\ScriptFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['project_id', 'title', 'word_count', 'deadline', 'status', 'started_at', 'completed_at', 'rate_type', 'rate', 'currency'])]
class Script extends Model
{
    /** @use HasFactory<ScriptFactory> */
    use HasFactory, SoftDeletes;

    public const STATUSES = ['pending', 'in_progress', 'review', 'completed'];

    protected function casts(): array
    {
        return ['word_count' => 'integer', 'deadline' => 'date', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'rate' => 'decimal:6'];
    }

    public function segments(): HasMany
    {
        return $this->hasMany(Segment::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
