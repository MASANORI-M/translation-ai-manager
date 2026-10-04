<?php

namespace Database\Factories;

use App\Models\Script;
use App\Models\Segment;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Segment> */
class SegmentFactory extends Factory {
    /** @return array<string, mixed> */
    public function definition(): array {
        return [
            'script_id' => Script::factory(),
            'sequence' => 1,
            'source_text' => 'Hello world from this video.',
            'status' => 'pending',
        ];
    }
}
