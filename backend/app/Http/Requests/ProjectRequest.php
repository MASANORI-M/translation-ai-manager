<?php

namespace App\Http\Requests;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectRequest extends FormRequest {
    public function authorize(): bool {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void {
        if (is_string($this->input('currency'))) {
            $this->merge(['currency' => strtoupper(trim($this->input('currency')))]);
        }
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array {
        return [
            'user_id' => ['missing'],
            'name' => ['required', 'string', 'max:255'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'translation_style' => ['nullable', 'string', 'max:10000'],
            'translation_rules' => ['nullable', 'string', 'max:10000'],
            'rate_type' => ['required', Rule::in(Project::RATE_TYPES)],
            'rate' => ['required', 'numeric', 'min:0', 'regex:/^\d{1,12}(\.\d{1,6})?$/'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'usd_jpy_rate' => ['nullable', 'numeric', 'gt:0', 'regex:/^\d{1,6}(\.\d{1,6})?$/'],
            'status' => ['required', Rule::in(Project::STATUSES)],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array {
        return [
            'rate.regex' => '単価は整数部12桁以内、小数部6桁以内の金額を入力してください。',
            'currency.regex' => '通貨はUSDやJPYのように英字3文字で入力してください。',
            'usd_jpy_rate.gt' => '為替レートは0より大きい値を入力してください。',
            'usd_jpy_rate.regex' => '為替レートは整数部6桁以内、小数部6桁以内で入力してください。',
        ];
    }
}
