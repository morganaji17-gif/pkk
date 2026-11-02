<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Grup pilihan varian untuk satu produk.
 * Contoh: "Level Pedas" (single: boleh pilih 1) atau
 * "Topping" (multiple: boleh pilih banyak).
 */
class ProductOptionGroup extends Model
{
    protected $fillable = [
        'product_id',
        'name',
        'selection_type',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function options()
    {
        return $this->hasMany(ProductOption::class, 'option_group_id');
    }
}
