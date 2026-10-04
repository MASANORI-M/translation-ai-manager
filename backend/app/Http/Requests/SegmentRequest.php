<?php

namespace App\Http\Requests;

use App\Models\Segment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SegmentRequest extends FormRequest {
    public function authorize(): bool {
        return $this->user() !== null;
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array {
        return [
            'script_id' => ['missing'],
            'ai_translation' => ['prohibited'],
            'ai_generation_id' => ['prohibited'],
            'ai_source_version' => ['prohibited'],
            'sequence' => ['required', 'integer', 'min:1', 'max:4294967295'],
            'timecode_start' => ['nullable', 'string', 'regex:/^(?:\d{1,4}:[0-5]\d|[0-5]?\d):[0-5]\d(?:\.\d{1,3})?$/'],
            'timecode_end' => ['nullable', 'string', 'regex:/^(?:\d{1,4}:[0-5]\d|[0-5]?\d):[0-5]\d(?:\.\d{1,3})?$/'],
            'emotion' => ['nullable', 'string', 'max:65535'],
            'source_text' => ['required', 'string', 'max:65535', function (string $attribute, mixed $value, \Closure $fail): void {
                if (is_string($value) && trim($value) === '') {
                    $fail('原文を入力してください。');
                }
            }],
            'final_translation' => ['nullable', 'string', 'max:65535'],
            'memo' => ['nullable', 'string', 'max:65535'],
            'status' => ['required', Rule::in(Segment::STATUSES)],
            'version' => [$this->isMethod('post') ? 'missing' : 'required', 'integer', 'min:1'],
        ];
    }

    public function after(): array {
        return [function ($validator): void {
            $start = $this->input('timecode_start');
            $end = $this->input('timecode_end');
            if (($start === null) !== ($end === null)) {
                $validator->errors()->add('timecode_end', '開始と終了のTimecodeを両方入力してください。');
            }
            if (is_string($start) && is_string($end) && ! $validator->errors()->has('timecode_start') && ! $validator->errors()->has('timecode_end') && $this->milliseconds($end) < $this->milliseconds($start)) {
                $validator->errors()->add('timecode_end', '終了Timecodeは開始以降にしてください。');
            }
            foreach (['emotion', 'source_text', 'final_translation', 'memo'] as $field) {
                if (is_string($this->input($field)) && strlen($this->input($field)) > 65535) {
                    $validator->errors()->add($field, 'テキストは65,535バイト以内にしてください。');
                }
            }
            if ($this->input('status') === 'completed' && ! is_string($this->input('final_translation'))) {
                $validator->errors()->add('final_translation', '完了には最終訳が必要です。');
            } elseif ($this->input('status') === 'completed' && trim($this->input('final_translation')) === '') {
                $validator->errors()->add('final_translation', '完了には最終訳が必要です。');
            }
        }];
    }

    private function milliseconds(string $timecode): int {
        $parts = explode(':', $timecode);
        $seconds = (float) array_pop($parts);
        $minutes = (int) array_pop($parts);
        $hours = (int) ($parts[0] ?? 0);

        return (int) round((($hours * 3600) + ($minutes * 60) + $seconds) * 1000);
    }
}
