<?php

namespace App\Services;

use App\Models\RestaurantTable;
use Illuminate\Support\Facades\Crypt;

/**
 * Token akses meja untuk checkout pelanggan.
 *
 * Dua lapis:
 * 1. public_token permanen (kolom DB) — dipakai di URL QR `/menu?t=...`.
 * 2. checkout_token jangka pendek (terenkripsi + kedaluwarsa) — dikirim
 *    frontend saat checkout. QR lama `?table=5` tetap bisa karena resolve
 *    by-ID menerbitkan checkout_token baru, bukan membocorkan public_token.
 */
class TableAccessService
{
    private const TTL_MINUTES = 60;

    public function issueCheckoutToken(RestaurantTable $table): string
    {
        $payload = json_encode([
            'tid' => (int) $table->id,
            'exp' => now()->addMinutes(self::TTL_MINUTES)->getTimestamp(),
        ]);

        return Crypt::encryptString($payload);
    }

    /**
     * @return RestaurantTable|null null jika token rusak/kedaluwarsa/meja tidak ada
     */
    public function resolveCheckoutToken(?string $token): ?RestaurantTable
    {
        if (!$token) {
            return null;
        }

        try {
            $payload = json_decode(Crypt::decryptString($token), true);
        } catch (\Throwable $e) {
            return null;
        }

        if (!is_array($payload) || empty($payload['tid']) || empty($payload['exp'])) {
            return null;
        }
        if ((int) $payload['exp'] < now()->getTimestamp()) {
            return null;
        }

        return RestaurantTable::find((int) $payload['tid']);
    }

    public static function qrUrl(RestaurantTable $table): string
    {
        return rtrim(config('app.frontend_url'), '/') . '/menu?t=' . $table->public_token;
    }
}
