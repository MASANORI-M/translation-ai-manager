<?php

namespace App\Services;

use App\Models\Script;

class EstimatedPayment {
    public function calculate(Script $script): ?string {
        if ($script->rate_type === 'hourly') {
            return null;
        }
        $factor = $script->rate_type === 'fixed' ? 1 : $script->word_count;
        $scale = $script->rate_type === 'per_100_words' ? 8 : 6;
        $digits = str_replace('.', '', $script->rate);
        $product = '';
        $carry = 0;
        for ($index = strlen($digits) - 1; $index >= 0; $index--) {
            $value = ((int) $digits[$index]) * $factor + $carry;
            $product = ($value % 10).$product;
            $carry = intdiv($value, 10);
        }
        $product = str_pad(($carry ? (string) $carry : '').$product, $scale + 1, '0', STR_PAD_LEFT);
        $precision = match ($script->currency) {
            'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF' => 0,
            'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND' => 3,
            'CLF', 'UYW' => 4,
            default => 2,
        };
        $cut = strlen($product) - $scale + $precision;
        $rounded = substr($product, 0, $cut);
        if ((int) $product[$cut] >= 5) {
            $carry = 1;
            for ($index = strlen($rounded) - 1; $index >= 0 && $carry; $index--) {
                $value = (int) $rounded[$index] + $carry;
                $rounded[$index] = (string) ($value % 10);
                $carry = intdiv($value, 10);
            }
            if ($carry) {
                $rounded = '1'.$rounded;
            }
        }
        $rounded = str_pad(ltrim($rounded, '0'), $precision + 1, '0', STR_PAD_LEFT);

        return $precision ? substr($rounded, 0, -$precision).'.'.substr($rounded, -$precision) : $rounded;
    }
}
