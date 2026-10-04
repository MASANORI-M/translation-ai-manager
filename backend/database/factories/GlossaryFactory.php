<?php

namespace Database\Factories;

use App\Models\Glossary;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Glossary>
 */
class GlossaryFactory extends Factory {
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'project_id' => Project::factory(),
            'source_term' => fake()->unique()->word(),
            'source_term_key' => fn (array $attributes): string => hash('sha256', mb_strtolower(trim($attributes['source_term']), 'UTF-8')),
            'target_term' => '用語の訳',
            'note' => null,
        ];
    }
}
