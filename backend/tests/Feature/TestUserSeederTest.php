<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\TestUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class TestUserSeederTest extends TestCase {
    use RefreshDatabase;

    public function test_seeder_creates_the_configured_account_without_overwriting_it_on_rerun(): void {
        config(['test_user.email' => 'local-test@example.com', 'test_user.password' => 'test-password']);
        $this->seed(TestUserSeeder::class);
        $firstHash = User::query()->firstOrFail()->password;
        $this->seed(TestUserSeeder::class);

        $this->assertDatabaseCount('users', 1);
        $user = User::query()->firstOrFail();
        $this->assertSame('local-test@example.com', $user->email);
        $this->assertTrue(Hash::check('test-password', $user->password));
        $this->assertSame($firstHash, $user->password);
    }

    public function test_seeder_requires_configuration(): void {
        config(['test_user.email' => null, 'test_user.password' => null]);
        $this->expectException(RuntimeException::class);
        $this->seed(TestUserSeeder::class);
    }

    public function test_seeder_cannot_run_in_production(): void {
        $this->app['env'] = 'production';
        $this->expectException(RuntimeException::class);
        app(TestUserSeeder::class)->run();
    }
}
