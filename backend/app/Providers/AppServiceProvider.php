<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider {
    public function register(): void {
        //
    }

    public function boot(): void {
        Sanctum::getAccessTokenFromRequestUsing(fn (Request $request): ?string => null);

        RateLimiter::for('registration', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        RateLimiter::for('ai-translation', fn (Request $request) => Limit::perMinute(10)->by((string) $request->user()->id));

        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(hash('sha256', Str::lower((string) $request->input('email')).'|'.$request->ip())),
            Limit::perMinute(20)->by($request->ip()),
        ]);
    }
}
