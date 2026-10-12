<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes;

    public const LOW_STOCK_THRESHOLD = 10;

    protected $appends = [
        'stock_status',
    ];

    protected $fillable = [
        'category_id',
        'name',
        'description',
        'price',
        'cost_price',
        'stock',
        'image',
        'is_active',
    ];

    protected $casts = [
    'is_active' => 'boolean',
    'price' => 'decimal:2',
    'cost_price' => 'decimal:2',
    'deleted_at' => 'datetime',
];

    public function getStockStatusAttribute(): string
    {
        $stock = (int) $this->stock;

        if ($stock <= 0) {
            return 'out';
        }

        if ($stock <= self::LOW_STOCK_THRESHOLD) {
            return 'low';
        }

        return 'normal';
    }
    public function category()
    {
        return $this->belongsTo(Category::class);
    }
    public function orderItems()
{
    return $this->hasMany(OrderItem::class);
}
}
