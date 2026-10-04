<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('scripts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->restrictOnDelete();
            $table->string('title');
            $table->unsignedInteger('word_count')->default(0);
            $table->date('deadline')->nullable();
            $table->string('status', 20)->default('pending');
            $table->dateTime('started_at', 6)->nullable();
            $table->dateTime('completed_at', 6)->nullable();
            $table->string('rate_type', 20);
            $table->decimal('rate', 18, 6);
            $table->char('currency', 3);
            $table->timestamps(6);
            $table->softDeletes('deleted_at', 6);
            $table->index(['project_id', 'deleted_at', 'status']);
            $table->index('deadline');
        });
    }

    public function down(): void {
        Schema::dropIfExists('scripts');
    }
};
