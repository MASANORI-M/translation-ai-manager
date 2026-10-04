<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GlossaryRequest extends FormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<mixed>>
     */
    public function rules(): array {
        return [
            'project_id' => ['missing'],
            'source_term_key' => ['missing'],
            'source_term' => ['required', 'string', 'max:255'],
            'target_term' => ['required', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:10000'],
        ];
    }
}
