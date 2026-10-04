<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void {
        Schema::create('projects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('client_name')->nullable();
            $table->text('description')->nullable();
            $table->text('translation_style')->nullable();
            $table->text('translation_rules')->nullable();
            $table->string('rate_type', 20);
            $table->decimal('rate', 18, 6)->unsigned();
            $table->char('currency', 3);
            $table->string('status', 20)->default('active');
            $table->timestamps(6);
            $table->softDeletes('deleted_at', 6);
            $table->index(['user_id', 'deleted_at', 'status', 'id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('projects');
    }
};
