<?php

namespace App\Services;

class AiCostCalculator {
    /** @param array<string, mixed> $model
     * @return array<string, mixed>
     */
    public function snapshot(array $model): array {
        return [
            'currency' => config('ai.currency'), 'unit' => config('ai.price_unit'),
            'checked_at' => config('ai.pricing_checked_at'), 'source' => config('ai.pricing_source'),
            'service_tier' => config('ai.service_tier'), 'calculation_version' => 1,
            'prices' => $model['prices'], 'long_context_prices' => $model['long_context_prices'],
            'long_context_threshold' => config('ai.long_context_threshold'),
        ];
    }

    /** @param array<string, mixed> $usage
     * @param  array<string, mixed>  $snapshot
     * @return array{input_cost: ?string, output_cost: ?string, total_cost: ?string, cost_status: string}
     */
    public function calculate(array $usage, array $snapshot): array {
        $cached = data_get($usage, 'input_tokens_details.cached_tokens');
        $writes = data_get($usage, 'input_tokens_details.cache_write_tokens');
        if (! is_int($cached) || ! is_int($writes) || (array_key_exists('resolved_service_tier', $snapshot) && $snapshot['resolved_service_tier'] !== $snapshot['service_tier'])) {
            return ['input_cost' => null, 'output_cost' => null, 'total_cost' => null, 'cost_status' => 'unknown'];
        }
        $prices = $usage['input_tokens'] > $snapshot['long_context_threshold'] ? $snapshot['long_context_prices'] : $snapshot['prices'];
        $ordinary = $usage['input_tokens'] - $cached - $writes;
        $input = bcadd(bcadd(bcmul((string) $ordinary, $prices['input'], 16), bcmul((string) $cached, $prices['cached_input'], 16), 16), bcmul((string) $writes, $prices['cache_write'], 16), 16);
        $inputCost = $this->round(bcdiv($input, (string) $snapshot['unit'], 16));
        $outputCost = $this->round(bcdiv(bcmul((string) $usage['output_tokens'], $prices['output'], 16), (string) $snapshot['unit'], 16));

        return ['input_cost' => $inputCost, 'output_cost' => $outputCost, 'total_cost' => bcadd($inputCost, $outputCost, 10), 'cost_status' => 'calculated'];
    }

    private function round(string $value): string {
        return bcadd($value, '0.00000000005', 10);
    }
}
