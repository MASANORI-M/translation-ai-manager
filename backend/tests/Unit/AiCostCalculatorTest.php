<?php

namespace Tests\Unit;

use App\Services\AiCostCalculator;
use PHPUnit\Framework\TestCase;

class AiCostCalculatorTest extends TestCase {
    /** @return array<string, mixed> */
    private function snapshot(): array {
        return [
            'unit' => 1000000, 'long_context_threshold' => 272000,
            'prices' => ['input' => '0.10', 'cached_input' => '0.01', 'cache_write' => '0.125', 'output' => '0.50'],
            'long_context_prices' => ['input' => '0.20', 'cached_input' => '0.02', 'cache_write' => '0.25', 'output' => '0.75'],
        ];
    }

    public function test_calculates_cache_reads_writes_and_output_without_counting_reasoning_twice(): void {
        $result = (new AiCostCalculator)->calculate([
            'input_tokens' => 1000, 'input_tokens_details' => ['cached_tokens' => 200, 'cache_write_tokens' => 100],
            'output_tokens' => 100, 'output_tokens_details' => ['reasoning_tokens' => 30],
        ], $this->snapshot());
        $this->assertSame(['input_cost' => '0.0000845000', 'output_cost' => '0.0000500000', 'total_cost' => '0.0001345000', 'cost_status' => 'calculated'], $result);
    }

    public function test_rounds_tiny_cost_half_up_to_ten_decimal_places(): void {
        $result = (new AiCostCalculator)->calculate(['input_tokens' => 1, 'input_tokens_details' => ['cached_tokens' => 0, 'cache_write_tokens' => 1], 'output_tokens' => 0], $this->snapshot());
        $this->assertSame('0.0000001250', $result['total_cost']);
        $snapshot = $this->snapshot();
        $snapshot['prices']['cache_write'] = '0.00005';
        $result = (new AiCostCalculator)->calculate(['input_tokens' => 1, 'input_tokens_details' => ['cached_tokens' => 0, 'cache_write_tokens' => 1], 'output_tokens' => 0], $snapshot);
        $this->assertSame('0.0000000001', $result['total_cost']);
    }

    public function test_long_context_uses_snapshot_tier_for_whole_request(): void {
        $calculator = new AiCostCalculator;
        $usage = ['input_tokens' => 272000, 'input_tokens_details' => ['cached_tokens' => 0, 'cache_write_tokens' => 0], 'output_tokens' => 100];
        $this->assertSame('0.0272500000', $calculator->calculate($usage, $this->snapshot())['total_cost']);
        $usage['input_tokens']++;
        $this->assertSame('0.0544752000', $calculator->calculate($usage, $this->snapshot())['total_cost']);
    }

    public function test_missing_cache_details_remain_unknown_and_explicit_zero_is_calculated(): void {
        $calculator = new AiCostCalculator;
        $this->assertNull($calculator->calculate(['input_tokens' => 100, 'output_tokens' => 20], $this->snapshot())['total_cost']);
        $usage = ['input_tokens' => 0, 'input_tokens_details' => ['cached_tokens' => 0, 'cache_write_tokens' => 0], 'output_tokens' => 0];
        $this->assertSame('0.0000000000', $calculator->calculate($usage, $this->snapshot())['total_cost']);
    }

    public function test_unexpected_processing_tier_does_not_use_standard_prices(): void {
        $usage = ['input_tokens' => 100, 'input_tokens_details' => ['cached_tokens' => 0, 'cache_write_tokens' => 0], 'output_tokens' => 10];
        $snapshot = [...$this->snapshot(), 'service_tier' => 'default', 'resolved_service_tier' => 'priority'];
        $this->assertSame('unknown', (new AiCostCalculator)->calculate($usage, $snapshot)['cost_status']);
    }
}
