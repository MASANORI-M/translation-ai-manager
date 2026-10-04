<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\UserRepository;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService {
    public function __construct(private UserRepository $users) {}

    public function register(string $email, string $password): User {
        $user = $this->users->create([
            'name' => Str::limit(Str::before($email, '@'), 100, ''),
            'email' => $email,
            'password' => Hash::make($password),
        ]);

        Auth::guard('web')->login($user);

        return $user;
    }

    public function login(string $email, string $password): User {
        $user = $this->users->findByEmail($email);

        if ($user === null) {
            Hash::make($password);
        }

        if ($user === null || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['メールアドレスまたはパスワードが正しくありません。'],
            ]);
        }

        Auth::guard('web')->login($user);

        return $user;
    }

    public function currentUser(): User {
        $user = Auth::guard('web')->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }

    public function logout(): void {
        Auth::guard('web')->logout();
    }
}
