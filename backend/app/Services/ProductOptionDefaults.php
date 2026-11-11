<?php

namespace App\Services;

use App\Models\Product;

/**
 * Opsi/varian default per kategori produk.
 *
 * - Makanan (category name berisi "makan" / "food"): Level Kepedasan
 * - Minuman (category name berisi "minum" / "beverage" / "drink"): Ice/No Ice + Level Gula
 */
class ProductOptionDefaults
{
    /**
     * Option groups untuk produk kategori Makanan.
     */
    public const FOOD_GROUPS = [
        'Level Kepedasan' => [
            'Tidak Pedas',
            'Level 1',
            'Level 2',
            'Level 3',
            'Level 4',
            'Level 5',
        ],
    ];

    /**
     * Option groups untuk produk kategori Minuman.
     */
    public const BEVERAGE_GROUPS = [
        'Ice / No Ice' => [
            'Ice',
            'No Ice',
        ],
        'Level Gula' => [
            'Less Sugar',
            'Normal Sugar',
            'High Sugar',
        ],
    ];

    /**
     * Nama-nama grup makanan.
     *
     * @return array<string>
     */
    public static function foodGroupNames(): array
    {
        return array_keys(self::FOOD_GROUPS);
    }

    /**
     * Nama-nama grup minuman.
     *
     * @return array<string>
     */
    public static function beverageGroupNames(): array
    {
        return array_keys(self::BEVERAGE_GROUPS);
    }

    /**
     * Backward-compat: GROUPS berisi semua grup.
     */
    public const GROUPS = self::FOOD_GROUPS + self::BEVERAGE_GROUPS;

    /**
     * Cek apakah kategori produk termasuk "makanan" berdasarkan nama.
     */
    public static function isFoodCategory(Product $product): bool
    {
        $name = strtolower($product->category?->name ?? '');
        return str_contains($name, 'makan') || str_contains($name, 'food');
    }

    /**
     * Cek apakah kategori produk termasuk "minuman" berdasarkan nama.
     */
    public static function isBeverageCategory(Product $product): bool
    {
        $name = strtolower($product->category?->name ?? '');
        return str_contains($name, 'minum') || str_contains($name, 'beverage') || str_contains($name, 'drink');
    }

    /**
     * Ambil grup opsi yang sesuai untuk satu produk.
     *
     * @return array<string, array<string>>  [groupName => [optionLabels]]
     */
    public static function getGroupsFor(Product $product): array
    {
        // Load relasi category jika belum ter-load
        if (!$product->relationLoaded('category')) {
            $product->load('category');
        }

        if (self::isBeverageCategory($product)) {
            return self::BEVERAGE_GROUPS;
        }

        if (self::isFoodCategory($product)) {
            return self::FOOD_GROUPS;
        }

        // Kategori tidak dikenal (mis. "Cemilan", "Dessert", "Snack"):
        // jangan paksakan opsi bawaan apa pun. Admin bisa menambah manual.
        return [];
    }

    /**
     * Terapkan opsi default ke satu produk. Idempoten.
     */
    public static function apply(Product $product): void
    {
        $groups = self::getGroupsFor($product);

        foreach ($groups as $groupName => $labels) {
            $group = $product->optionGroups()->firstOrCreate(
                ['name' => $groupName],
                [
                    'selection_type' => 'single',
                    'required' => true,
                    'min_selections' => 1,
                    'max_selections' => 1,
                    'sort_order' => 0,
                ]
            );

            foreach ($labels as $idx => $label) {
                $group->options()->firstOrCreate(
                    ['label' => $label],
                    ['additional_price' => 0, 'sort_order' => $idx]
                );
            }
        }
    }
}
