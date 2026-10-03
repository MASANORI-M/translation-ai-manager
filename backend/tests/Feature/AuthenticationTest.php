<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173']);
    }

    public function test_registration_creates_a_hashed_password_and_logs_the_user_in(): void
    {
        $response = $this->postJson('/api/register', [
            'email' => 'Translator@Example.com',
            'password' => 'test-password',
            'password_confirmation' => 'test-password',
        ]);

        $response->assertCreated()->assertJsonPath('data.email', 'translator@example.com');
        $response->assertJsonMissingPath('data.password');
        $response->assertJsonMissingPath('data.name');
        $user = User::query()->firstOrFail();
        $this->assertTrue(Hash::check('test-password', $user->password));
        $this->assertNotSame('test-password', $user->password);
        $this->assertAuthenticatedAs($user, 'web');
        $this->getJson('/api/user')->assertOk()->assertJsonPath('data.id', $user->id);
    }

    /** @return array<string, array{array<string, string>, string}> */
    public static function invalidRegistrations(): array
    {
        return [
            'multi-byte password beyond bcrypt limit' => [['email' => 'translator@example.com', 'password' => str_repeat('あ', 25), 'password_confirmation' => str_repeat('あ', 25)], 'password'],
            'missing email' => [['password' => 'test-password', 'password_confirmation' => 'test-password'], 'email'],
            'invalid email' => [['email' => 'invalid', 'password' => 'test-password', 'password_confirmation' => 'test-password'], 'email'],
            'missing password' => [['email' => 'translator@example.com'], 'password'],
            'short password' => [['email' => 'translator@example.com', 'password' => 'short', 'password_confirmation' => 'short'], 'password'],
            'missing confirmation' => [['email' => 'translator@example.com', 'password' => 'test-password'], 'password'],
            'mismatched confirmation' => [['email' => 'translator@example.com', 'password' => 'test-password', 'password_confirmation' => 'other-password'], 'password'],
        ];
    }

    #[DataProvider('invalidRegistrations')]
    public function test_invalid_registration_does_not_create_a_user(array $payload, string $field): void
    {
        $this->postJson('/api/register', $payload)->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('users', 0);
        $this->assertGuest('web');
    }

    public function test_duplicate_email_is_rejected_after_normalization(): void
    {
        User::factory()->create(['email' => 'translator@example.com']);

        $this->postJson('/api/register', [
            'email' => ' Translator@Example.com ',
            'password' => 'test-password',
            'password_confirmation' => 'test-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->assertDatabaseCount('users', 1);
    }

    public function test_registration_can_be_disabled(): void
    {
        config(['auth.registration_enabled' => false]);

        $this->postJson('/api/register', [
            'email' => 'translator@example.com',
            'password' => 'test-password',
            'password_confirmation' => 'test-password',
        ])->assertForbidden();

        $this->assertDatabaseCount('users', 0);
    }

    public function test_login_authenticates_with_normalized_email(): void
    {
        $user = User::factory()->create(['email' => 'translator@example.com', 'password' => 'test-password']);

        $this->postJson('/api/login', ['email' => ' Translator@Example.com ', 'password' => 'test-password'])
            ->assertOk()->assertJsonPath('data.email', $user->email)->assertJsonMissingPath('data.password');

        $this->assertAuthenticatedAs($user, 'web');
        $this->getJson('/api/user')->assertOk()->assertJsonPath('data.id', $user->id);
    }

    public function test_invalid_credentials_do_not_reveal_whether_an_account_exists(): void
    {
        User::factory()->create(['email' => 'translator@example.com']);

        $wrong = $this->postJson('/api/login', ['email' => 'translator@example.com', 'password' => 'incorrect-password']);
        $missing = $this->postJson('/api/login', ['email' => 'unknown@example.com', 'password' => 'incorrect-password']);

        $wrong->assertUnprocessable()->assertJsonValidationErrors('email');
        $missing->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertSame($wrong->json('errors.email'), $missing->json('errors.email'));
        $this->assertGuest('web');
    }

    public function test_current_user_and_logout_require_authentication(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
        $this->postJson('/api/logout')->assertUnauthorized();
    }

    public function test_logout_invalidates_the_session_and_rotates_the_csrf_token(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'web')->withSession(['sentinel' => 'private']);
        $session = app('session')->driver();
        $oldId = $session->getId();
        $oldToken = $session->token();

        $this->postJson('/api/logout')->assertNoContent()->assertSessionMissing('sentinel');

        $this->assertGuest('web');
        $this->assertNotSame($oldId, $session->getId());
        $this->assertNotSame($oldToken, $session->token());
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_login_is_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/login', ['email' => 'unknown@example.com', 'password' => 'incorrect-password'])->assertUnprocessable();
        }

        $this->postJson('/api/login', ['email' => 'unknown@example.com', 'password' => 'incorrect-password'])
            ->assertStatus(429)->assertHeader('Retry-After');
    }

    public function test_bearer_tokens_are_not_used_by_this_spa_only_application(): void
    {
        $this->withHeaders(['Authorization' => 'Bearer unsupported-token'])->getJson('/api/user')->assertUnauthorized();
    }
}
