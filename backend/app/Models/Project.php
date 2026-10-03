<?php

namespace App\Models;

use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['user_id', 'name', 'client_name', 'description', 'translation_style', 'translation_rules', 'rate_type', 'rate', 'currency', 'status'])]
class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory, SoftDeletes;

    public const RATE_TYPES = ['per_100_words', 'per_word', 'hourly', 'fixed'];

    public const STATUSES = ['active', 'paused', 'completed', 'archived'];

    protected function casts(): array
    {
        return ['rate' => 'decimal:6'];
    }

    public function scripts(): HasMany
    {
        return $this->hasMany(Script::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
