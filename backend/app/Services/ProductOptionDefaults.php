<?php

namespace App\Services;

use App\Models\Product;

/**
 * Opsi/varian default yang dipakai untuk semua produk.
 */
class ProductOptionDefaults
{
    public const GROUPS = [
        'Level Kepedasan' => [
            'Tidak Pedas',
            'Level 1',
            'Level 2',
            'Level 3',
            'Level 4',
            'Level 5',
        ],
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
     * Terapkan opsi default ke satu produk. Idempoten.
     */
    public static function apply(Product $product): void
    {
        foreach (self::GROUPS as $groupName => $labels) {
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
