<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class OpenAIService {
    /** @param array<string, mixed> $settings
     * @return array{output: string, usage: array<string, mixed>, resolved_model: string, provider_response_id: string, service_tier: ?string}
     */
    public function translate(string $instruction, array $settings): array {
        $key = config('ai.api_key');
        if (! is_string($key) || trim($key) === '') {
            $this->fail('AI翻訳を利用するにはサーバーのOPENAI_API_KEYを設定してください。');
        }
        try {
            $response = Http::withToken($key)->acceptJson()->connectTimeout(config('ai.connect_timeout'))
                ->timeout(config('ai.timeout'))->post(config('ai.responses_url'), [
                    ...$settings,
                    'instructions' => $instruction,
                    'input' => 'Generate the Japanese localization for the Current Segment in the localization context.',
                    'store' => false,
                ]);
        } catch (ConnectionException) {
            $this->fail('AIサーバーへの接続がタイムアウトまたは失敗しました。結果を確認できないため、自動再送は行いません。');
        }
        if (! $response->successful()) {
            $this->fail(match ($response->status()) {
                401, 403 => 'AIサーバーの認証に失敗しました。サーバーのAPI設定を確認してください。',
                429 => 'AIの利用上限に達しました。時間をおいて再度お試しください。',
                400, 404, 422 => 'AIモデルまたはリクエストが利用できません。サーバーのモデル設定を確認してください。',
                408, 504 => 'AIサーバーがタイムアウトしました。自動再送は行いません。',
                default => 'AIサーバーでエラーが発生しました。時間をおいて再度お試しください。',
            });
        }
        $data = $response->json();
        if (! is_array($data) || ($data['status'] ?? null) !== 'completed' || ! empty($data['error']) || ! is_array($data['output'] ?? null)) {
            $this->fail('AI翻訳が完了しませんでした。出力上限やAIサーバーの状態を確認してください。');
        }
        $texts = [];
        foreach ($data['output'] ?? [] as $item) {
            if (! is_array($item)) {
                $this->fail('AIの応答が不正です。翻訳は保存されていません。');
            }
            if (($item['type'] ?? null) !== 'message' || ($item['role'] ?? null) !== 'assistant') {
                continue;
            }
            if (($item['status'] ?? null) !== 'completed' || ! is_array($item['content'] ?? null)) {
                $this->fail('AI翻訳が完了しませんでした。再度お試しください。');
            }
            foreach ($item['content'] ?? [] as $content) {
                if (! is_array($content)) {
                    $this->fail('AIの応答が不正です。翻訳は保存されていません。');
                }
                if (($content['type'] ?? null) === 'refusal') {
                    $this->fail('AIがこの原文の翻訳を拒否しました。原文を確認してください。');
                }
                if (($content['type'] ?? null) === 'output_text' && is_string($content['text'] ?? null)) {
                    $texts[] = $content['text'];
                }
            }
        }
        $output = trim(implode("\n", $texts));
        if ($output === '' || strlen($output) > 65535) {
            $this->fail('AIから保存可能な翻訳を取得できませんでした。原文を短くして再度お試しください。');
        }
        $usage = $data['usage'] ?? null;
        if (! is_array($usage)) {
            $this->fail('AIのToken Usageを取得できませんでした。翻訳は保存されていません。');
        }
        foreach (['input_tokens', 'output_tokens', 'total_tokens'] as $field) {
            if (! is_int($usage[$field] ?? null) || $usage[$field] < 0) {
                $this->fail('AIのToken Usageが不正です。翻訳は保存されていません。');
            }
        }
        $cached = data_get($usage, 'input_tokens_details.cached_tokens');
        $writes = data_get($usage, 'input_tokens_details.cache_write_tokens');
        foreach ([$cached, $writes] as $count) {
            if ($count !== null && (! is_int($count) || $count < 0 || $count > $usage['input_tokens'])) {
                $this->fail('AIのToken Usageが不正です。翻訳は保存されていません。');
            }
        }
        if (($cached ?? 0) + ($writes ?? 0) > $usage['input_tokens']) {
            $this->fail('AIのToken Usageが不正です。翻訳は保存されていません。');
        }
        if (! is_string($data['model'] ?? null) || ! is_string($data['id'] ?? null)) {
            $this->fail('AIの応答が不正です。翻訳は保存されていません。');
        }

        return ['output' => $output, 'usage' => $usage, 'resolved_model' => $data['model'], 'provider_response_id' => $data['id'], 'service_tier' => $data['service_tier'] ?? null];
    }

    private function fail(string $message): never {
        throw ValidationException::withMessages(['ai_translation' => $message]);
    }
}
