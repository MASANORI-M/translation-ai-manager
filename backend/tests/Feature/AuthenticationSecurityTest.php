<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_and_registration_reject_missing_csrf_tokens(): void
    {
        $this->app['env'] = 'local';
        $this->withHeaders(['Origin' => 'http://localhost:5173']);

        $this->postJson('/api/login', ['email' => 'translator@example.com', 'password' => 'test-password'])->assertStatus(419);
        $this->postJson('/api/register', ['email' => 'translator@example.com', 'password' => 'test-password', 'password_confirmation' => 'test-password'])->assertStatus(419);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_csrf_endpoint_sets_session_and_xsrf_cookies(): void
    {
        $this->get('/sanctum/csrf-cookie')->assertNoContent()->assertCookie('XSRF-TOKEN')->assertCookie(config('session.cookie'));
    }

    public function test_cors_allows_credentials_from_the_configured_frontend(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'GET',
        ])->options('/sanctum/csrf-cookie')->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }
}
