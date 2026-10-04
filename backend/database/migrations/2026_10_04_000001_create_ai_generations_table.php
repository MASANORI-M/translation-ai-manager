<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('ai_generations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('segment_id')->constrained()->restrictOnDelete();
            $table->string('model');
            $table->string('model_name');
            $table->string('resolved_model')->nullable();
            $table->string('provider_response_id')->nullable();
            $table->longText('instruction');
            $table->text('source_text_snapshot');
            $table->unsignedInteger('source_version_snapshot');
            $table->longText('output');
            $table->unsignedBigInteger('input_tokens');
            $table->unsignedBigInteger('output_tokens');
            $table->unsignedBigInteger('total_tokens');
            $table->unsignedBigInteger('cached_input_tokens')->nullable();
            $table->unsignedBigInteger('cache_write_tokens')->nullable();
            $table->json('usage_details');
            $table->json('pricing_snapshot');
            $table->json('request_settings_snapshot');
            $table->string('cost_status', 20);
            $table->decimal('input_cost', 20, 10)->nullable();
            $table->decimal('output_cost', 20, 10)->nullable();
            $table->decimal('total_cost', 20, 10)->nullable();
            $table->boolean('selected')->default(false);
            $table->unsignedBigInteger('selected_segment_id')->nullable()->storedAs('CASE WHEN selected THEN segment_id ELSE NULL END');
            $table->unique('selected_segment_id');
            $table->timestamps(6);
            $table->index(['segment_id', 'id']);
        });
        Schema::table('segments', function (Blueprint $table): void {
            $table->longText('ai_translation')->nullable();
            $table->foreignId('ai_generation_id')->nullable()->constrained('ai_generations')->restrictOnDelete();
            $table->unsignedInteger('ai_source_version')->nullable();
        });
    }

    public function down(): void {
        Schema::table('segments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('ai_generation_id');
            $table->dropColumn(['ai_translation', 'ai_source_version']);
        });
        Schema::dropIfExists('ai_generations');
    }
};
