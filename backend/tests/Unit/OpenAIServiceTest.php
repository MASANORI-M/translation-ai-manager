<?php

namespace Tests\Unit;

use App\Services\OpenAIService;
use Illuminate\Config\Repository;
use Illuminate\Container\Container;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Http;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidatorFactory;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class OpenAIServiceTest extends TestCase {
    private Container $previousContainer;

    protected function setUp(): void {
        parent::setUp();
        $this->previousContainer = Container::getInstance();
        $container = new Container;
        $container->instance('config', new Repository(['ai' => [
            'api_key' => 'secret-test-key', 'responses_url' => 'https://api.openai.com/v1/responses',
            'timeout' => 90, 'connect_timeout' => 10,
        ]]));
        $container->instance(Factory::class, new Factory);
        $container->instance('validator', new ValidatorFactory(new Translator(new ArrayLoader, 'ja')));
        Container::setInstance($container);
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication($container);
        Http::preventStrayRequests();
    }

    protected function tearDown(): void {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication($this->previousContainer);
        Container::setInstance($this->previousContainer);
        parent::tearDown();
    }

    /** @return array<string, mixed> */
    private function response(): array {
        return [
            'id' => 'response-id', 'model' => 'test-model', 'status' => 'completed',
            'output' => [
                ['type' => 'reasoning', 'summary' => []],
                ['type' => 'message', 'role' => 'assistant', 'status' => 'completed', 'content' => [['type' => 'output_text', 'text' => 'こんにちは。']]],
            ],
            'usage' => ['input_tokens' => 20, 'output_tokens' => 5, 'total_tokens' => 25, 'input_tokens_details' => ['cached_tokens' => 0, 'cache_write_tokens' => 0]],
        ];
    }

    public function test_extracts_only_assistant_output_and_preserves_usage(): void {
        Http::fake(['*' => Http::response($this->response())]);
        $result = (new OpenAIService)->translate('Prompt', ['model' => 'test-model']);
        $this->assertSame('こんにちは。', $result['output']);
        $this->assertSame(25, $result['usage']['total_tokens']);
        Http::assertSent(fn ($request): bool => $request['store'] === false && $request['instructions'] === 'Prompt');
        Http::assertSentCount(1);
    }

    /** @return array<string, array{string, int}> */
    public static function failures(): array {
        return [
            'missing key' => ['missing_key', 200], 'auth' => ['http', 401], 'rate limit' => ['http', 429],
            'invalid model' => ['http', 404], 'server error' => ['http', 500], 'timeout' => ['timeout', 200],
            'invalid JSON' => ['invalid_json', 200], 'empty output' => ['empty', 200], 'incomplete' => ['incomplete', 200],
            'refusal' => ['refusal', 200], 'missing usage' => ['missing_usage', 200], 'invalid cached usage' => ['invalid_usage', 200],
        ];
    }

    #[DataProvider('failures')]
    public function test_errors_are_safe_and_requests_are_never_automatically_retried(string $failure, int $status): void {
        $data = $this->response();
        if ($failure === 'missing_key') {
            config(['ai.api_key' => '']);
        } elseif ($failure === 'empty') {
            $data['output'] = [];
        } elseif ($failure === 'incomplete') {
            $data['status'] = 'incomplete';
        } elseif ($failure === 'missing_usage') {
            unset($data['usage']);
        } elseif ($failure === 'invalid_usage') {
            $data['usage']['input_tokens_details']['cached_tokens'] = 999;
        } elseif ($failure === 'refusal') {
            $data['output'][1]['content'] = [['type' => 'refusal', 'refusal' => 'secret-test-key internal-details']];
        }
        Http::fake(['*' => $failure === 'timeout' ? Http::failedConnection('secret-test-key internal-details') : Http::response($failure === 'invalid_json' ? 'invalid JSON' : ($status === 200 ? $data : ['error' => ['message' => 'secret-test-key internal-details']]), $status)]);
        try {
            (new OpenAIService)->translate('Prompt', ['model' => 'test-model']);
            $this->fail('An invalid response must not produce a translation.');
        } catch (ValidationException $exception) {
            $message = implode(' ', $exception->errors()['ai_translation']);
            $this->assertStringNotContainsString('secret-test-key', $message);
            $this->assertStringNotContainsString('internal-details', $message);
        }
        Http::assertSentCount($failure === 'missing_key' ? 0 : 1);
    }
}
