<?php

namespace App\Repositories;

use App\Models\User;

class UserRepository
{
    public function findByEmail(string $email): ?User
    {
        return User::query()->where('email', $email)->first();
    }

    /** @param array{name: string, email: string, password: string} $attributes */
    public function create(array $attributes): User
    {
        return User::query()->create($attributes);
    }
}
