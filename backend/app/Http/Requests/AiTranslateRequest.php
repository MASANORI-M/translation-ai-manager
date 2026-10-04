<?php

namespace App\Http\Requests;

use App\Services\AiModelCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AiTranslateRequest extends FormRequest {
    public function authorize(): bool {
        return $this->user() !== null;
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array {
        return [
            'model' => ['required', 'string', Rule::in(array_keys(app(AiModelCatalog::class)->allowed()))],
            'version' => ['sometimes', 'required', 'integer', 'min:1'],
            'input_cost' => ['prohibited'], 'output_cost' => ['prohibited'], 'total_cost' => ['prohibited'],
            'instruction' => ['prohibited'], 'output' => ['prohibited'], 'selected' => ['prohibited'],
        ];
    }
}
