<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Project> */
class ProjectFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->sentence(3),
            'client_name' => fake()->company(),
            'description' => null,
            'translation_style' => '自然な日本語',
            'translation_rules' => null,
            'rate_type' => 'per_100_words',
            'rate' => '2.500000',
            'currency' => 'USD',
            'status' => 'active',
        ];
    }
}
