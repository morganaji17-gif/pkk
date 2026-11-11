<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Services\ProductOptionDefaults;
use Illuminate\Database\Seeder;

/**
 * Opsi/varian default untuk produk yang belum punya opsi.
 *
 * Non-destruktif: produk yang sudah memiliki grup opsi (mungkin sudah
 * diatur admin lewat "Kelola Opsi") dilewati. Aman dijalankan berulang.
 */
class ProductOptionSeeder extends Seeder
{
    public function run(): void
    {
        Product::query()
            ->with('category')
            ->chunkById(100, function ($products) {
                foreach ($products as $product) {
                    if ($product->optionGroups()->exists()) {
                        continue;
                    }

                    ProductOptionDefaults::apply($product);
                }
            });
    }
}
