<?php

return [
    'api_key' => env('OPENAI_API_KEY'),
    'responses_url' => 'https://api.openai.com/v1/responses',
    'timeout' => 90,
    'connect_timeout' => 10,
    'max_output_tokens' => 8192,
    'default_model' => 'gpt-6-luna',
    'pricing_checked_at' => '2026-10-04',
    'pricing_source' => 'https://developers.openai.com/api/docs/pricing',
    'currency' => 'USD',
    'price_unit' => 1000000,
    'service_tier' => 'default',
    'long_context_threshold' => 272000,
    'models' => [
        'gpt-6-luna' => [
            'name' => 'GPT-6 Luna',
            'enabled' => true,
            'reasoning_effort' => 'none',
            'prices' => ['input' => '0.10', 'cached_input' => '0.01', 'cache_write' => '0.125', 'output' => '0.50'],
            'long_context_prices' => ['input' => '0.20', 'cached_input' => '0.02', 'cache_write' => '0.25', 'output' => '0.75'],
        ],
        'gpt-6.1-sol' => [
            'name' => 'GPT-6.1 Sol',
            'enabled' => true,
            'reasoning_effort' => 'low',
            'prices' => ['input' => '2.00', 'cached_input' => '0.10', 'cache_write' => '2.50', 'output' => '10.00'],
            'long_context_prices' => ['input' => '4.00', 'cached_input' => '0.20', 'cache_write' => '5.00', 'output' => '15.00'],
        ],
        'gpt-6-sol' => [
            'name' => 'GPT-6 Sol',
            'enabled' => true,
            'reasoning_effort' => 'low',
            'prices' => ['input' => '2.00', 'cached_input' => '0.20', 'cache_write' => '2.50', 'output' => '10.00'],
            'long_context_prices' => ['input' => '4.00', 'cached_input' => '0.40', 'cache_write' => '5.00', 'output' => '15.00'],
        ],
    ],
];
