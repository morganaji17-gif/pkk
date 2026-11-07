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
        'required',
        'min_selections',
        'max_selections',
        'sort_order',
    ];

    protected $casts = [
        'required' => 'boolean',
        'min_selections' => 'integer',
        'max_selections' => 'integer',
        'sort_order' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function options()
    {
        return $this->hasMany(ProductOption::class, 'option_group_id')->orderBy('sort_order')->orderBy('label');
    }
}
