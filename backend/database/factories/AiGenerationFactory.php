<?php

namespace Database\Factories;

use App\Models\AiGeneration;
use App\Models\Segment;
use App\Services\AiCostCalculator;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AiGeneration> */
class AiGenerationFactory extends Factory {
    /** @return array<string, mixed> */
    public function definition(): array {
        $id = config('ai.default_model');
        $model = config('ai.models')[$id];
        $snapshot = app(AiCostCalculator::class)->snapshot($model);
        $usage = ['input_tokens' => 100, 'output_tokens' => 20, 'total_tokens' => 120, 'input_tokens_details' => ['cached_tokens' => 0, 'cache_write_tokens' => 0]];

        return [
            'segment_id' => Segment::factory(), 'model' => $id, 'model_name' => $model['name'],
            'resolved_model' => $id, 'provider_response_id' => fake()->uuid(),
            'instruction' => 'Localize this English source into natural spoken Japanese.',
            'source_text_snapshot' => 'Hello world from this video.', 'source_version_snapshot' => 1,
            'output' => 'みんな、こんにちは！', 'input_tokens' => 100, 'output_tokens' => 20, 'total_tokens' => 120,
            'cached_input_tokens' => 0, 'cache_write_tokens' => 0, 'usage_details' => $usage,
            'pricing_snapshot' => $snapshot, 'request_settings_snapshot' => ['model' => $id],
            'glossary_snapshot' => [],
            ...app(AiCostCalculator::class)->calculate($usage, $snapshot), 'selected' => false,
        ];
    }
}
