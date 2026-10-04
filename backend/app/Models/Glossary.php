<?php

namespace App\Models;

use Database\Factories\GlossaryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'source_term', 'source_term_key', 'target_term', 'note'])]
class Glossary extends Model {
    /** @use HasFactory<GlossaryFactory> */
    use HasFactory;

    public function project(): BelongsTo {
        return $this->belongsTo(Project::class);
    }
}
