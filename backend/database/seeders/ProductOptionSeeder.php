<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Services\ProductOptionDefaults;
use Illuminate\Database\Seeder;

/**
 * Opsi/varian default untuk semua produk.
 * Idempoten: aman dijalankan berulang kali.
 */
class ProductOptionSeeder extends Seeder
{
    public function run(): void
    {
        Product::query()->chunkById(100, function ($products) {
            foreach ($products as $product) {
                ProductOptionDefaults::apply($product);
            }
        });

        // Pemaksaan required=true/min_selections=1 untuk produk yang sudah ada.
        // Ini dilakukan di luar chunk agar tidak bentrok dengan relasi loaded di atas.
        $defaultGroupNames = array_keys(ProductOptionDefaults::GROUPS);
        Product::query()
            ->with(['optionGroups'])
            ->chunkById(100, function ($products) use ($defaultGroupNames) {
                foreach ($products as $product) {
                    foreach ($product->optionGroups as $group) {
                        if (in_array($group->name, $defaultGroupNames, true)) {
                            $group->updateQuietly([
                                'required' => true,
                                'min_selections' => 1,
                                'max_selections' => 1,
                            ]);
                        }
                    }
                }
            });
    }
}
