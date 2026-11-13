<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('checkout', function ($request) {
            // Middleware berjalan sebelum FormRequest, jadi restaurant_table_id
            // dari token belum ter-resolve di sini. Pakai token mentah (di-hash)
            // sebagai kunci bila ada.
            $key = $request->input('restaurant_table_id')
                ?? ($request->input('checkout_token') ? md5((string) $request->input('checkout_token')) : null)
                ?? ($request->input('table_token') ? md5((string) $request->input('table_token')) : null)
                ?? 'unknown';
            return Limit::perMinute(20)->by($request->ip() . ':table:' . $key);
        });

        RateLimiter::for('tracking', function ($request) {
            $token = $request->route('trackingToken')
                ?? $request->route('orderNumber')
                ?? $request->input('tracking_token')
                ?? $request->input('order_number')
                ?? 'anon';
            return Limit::perMinute(60)->by($request->ip() . ':' . $token);
        });

        RateLimiter::for('login', function ($request) {
            $email = strtolower((string) $request->input('email'));
            return Limit::perMinute(5)->by($request->ip() . ':' . $email);
        });

        RateLimiter::for('public', function ($request) {
            return Limit::perMinute(60)->by($request->ip());
        });

        // Untuk endpoint internal yang sering di-polling oleh dashboard/staf.
        RateLimiter::for('internal', function ($request) {
            return Limit::perMinute(120)->by($request->ip());
        });
    }
}
