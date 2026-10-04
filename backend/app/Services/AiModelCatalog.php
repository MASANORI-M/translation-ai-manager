<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class AiModelCatalog {
    /** @return array<string, array<string, mixed>> */
    public function allowed(): array {
        return array_filter(config('ai.models'), fn (array $model): bool => $model['enabled']);
    }

    /** @return array{models: list<array{id: string, name: string}>, default_model: string|null} */
    public function listing(): array {
        $models = $this->allowed();
        $default = config('ai.default_model');

        return [
            'models' => array_map(fn (string $id, array $model): array => ['id' => $id, 'name' => $model['name']], array_keys($models), array_values($models)),
            'default_model' => isset($models[$default]) ? $default : (array_key_first($models)),
        ];
    }

    /** @return array<string, mixed> */
    public function get(string $id): array {
        $models = $this->allowed();
        if (! isset($models[$id])) {
            throw ValidationException::withMessages(['model' => '許可されたAIモデルを選択してください。']);
        }

        return $models[$id];
    }
}
