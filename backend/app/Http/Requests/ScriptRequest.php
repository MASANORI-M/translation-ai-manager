<?php

namespace App\Http\Requests;

use App\Models\Script;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ScriptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        return [
            'project_id' => ['missing'], 'user_id' => ['missing'],
            'rate' => ['missing'], 'rate_type' => ['missing'], 'currency' => ['missing'],
            'title' => ['required', 'string', 'max:255'],
            'word_count' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'deadline' => ['nullable', 'date_format:Y-m-d'],
            'status' => ['required', Rule::in(Script::STATUSES)],
            'started_at' => ['nullable', 'date'], 'completed_at' => ['nullable', 'date'],
        ];
    }
}
