<?php

namespace Database\Seeders;

use App\Repositories\UserRepository;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class TestUserSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Test users may only be seeded in local or testing environments.');
        }

        $email = config('test_user.email');
        $password = config('test_user.password');

        if (! is_string($email) || ! filter_var($email, FILTER_VALIDATE_EMAIL) || ! is_string($password) || strlen($password) < 8 || strlen($password) > 72) {
            throw new RuntimeException('Set a valid TEST_USER_EMAIL and an 8-72 character TEST_USER_PASSWORD in the local .env.');
        }

        $email = strtolower(trim($email));
        $users = app(UserRepository::class);

        if ($users->findByEmail($email) === null) {
            $users->create([
                'name' => 'Test User',
                'email' => $email,
                'password' => Hash::make($password),
            ]);
        }
    }
}
