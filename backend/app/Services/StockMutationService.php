<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockMutation;
use Illuminate\Support\Facades\DB;

class StockMutationService
{
    public static function record(
        Product $product,
        int $before,
        int $after,
        string $reason,
        ?int $orderId = null,
        ?int $userId = null
    ): void {
        StockMutation::create([
            'product_id' => $product->id,
            'order_id' => $orderId,
            'user_id' => $userId,
            'delta' => $after - $before,
            'stock_before' => $before,
            'stock_after' => $after,
            'reason' => $reason,
        ]);
    }

    public static function recordDecrement(
        Product $product,
        int $quantity,
        string $reason,
        ?int $orderId = null,
        ?int $userId = null
    ): void {
        $before = (int) $product->stock;

        $updated = DB::table('products')
            ->where('id', $product->id)
            ->where('stock', '>=', $quantity)
            ->decrement('stock', $quantity);

        if ($updated === 0) {
            throw new \Exception("Stok produk {$product->name} tidak mencukupi.");
        }

        $product->refresh();
        $after = (int) $product->stock;

        self::record($product, $before, $after, $reason, $orderId, $userId);
    }

    public static function recordIncrement(
        Product $product,
        int $quantity,
        string $reason,
        ?int $orderId = null,
        ?int $userId = null
    ): void {
        $before = (int) $product->stock;

        DB::table('products')
            ->where('id', $product->id)
            ->increment('stock', $quantity);

        $product->refresh();
        $after = (int) $product->stock;

        self::record($product, $before, $after, $reason, $orderId, $userId);
    }

    public static function recordSet(
        Product $product,
        int $newStock,
        string $reason,
        ?int $userId = null
    ): void {
        $before = (int) $product->stock;

        DB::table('products')
            ->where('id', $product->id)
            ->update(['stock' => $newStock]);

        $product->refresh();
        $after = (int) $product->stock;

        self::record($product, $before, $after, $reason, null, $userId);
    }
}