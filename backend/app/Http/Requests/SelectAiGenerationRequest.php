<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SelectAiGenerationRequest extends FormRequest {
    public function authorize(): bool {
        return $this->user() !== null;
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array {
        return ['version' => ['required', 'integer', 'min:1']];
    }
}
