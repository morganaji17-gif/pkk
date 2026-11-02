<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Satu pilihan/varian di dalam grup opsi produk.
 * Contoh: "Level 5" pada grup "Level Pedas" (+Rp 5000).
 */
class ProductOption extends Model
{
    protected $fillable = [
        'option_group_id',
        'label',
        'additional_price',
    ];

    protected $casts = [
        'additional_price' => 'decimal:2',
    ];

    public function group()
    {
        return $this->belongsTo(ProductOptionGroup::class, 'option_group_id');
    }
}
