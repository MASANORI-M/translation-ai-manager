<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('segments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('script_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('sequence');
            $table->unsignedBigInteger('timecode_start_ms')->nullable();
            $table->unsignedBigInteger('timecode_end_ms')->nullable();
            $table->text('emotion_direction')->nullable();
            $table->text('source_text');
            $table->unsignedInteger('source_version')->default(1);
            $table->text('final_translation')->nullable();
            $table->unsignedInteger('final_source_version')->nullable();
            $table->text('memo')->nullable();
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps(6);
            $table->softDeletes('deleted_at', 6);
            $table->unique(['script_id', 'sequence']);
            $table->index(['script_id', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('segments');
    }
};
