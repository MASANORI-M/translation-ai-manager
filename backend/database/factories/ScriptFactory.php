<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\Script;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Script> */
class ScriptFactory extends Factory {
    /** @return array<string, mixed> */
    public function definition(): array {
        return ['project_id' => Project::factory(), 'title' => fake()->sentence(3), 'word_count' => 4500, 'deadline' => null, 'status' => 'pending', 'rate_type' => 'per_100_words', 'rate' => '1.800000', 'currency' => 'USD'];
    }
}
