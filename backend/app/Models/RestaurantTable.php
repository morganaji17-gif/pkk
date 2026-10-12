<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RestaurantTable extends Model
{
    protected $fillable = [
    'table_number',
    'capacity',
    'qr_code',
    'is_available',
    'status',
    ];

    protected $casts = [
        'is_available' => 'boolean',
    ];

    protected $appends = [
        'effective_status',
    ];

    public function orders()
{
    return $this->hasMany(Order::class);
}

    public function activeOrders()
{
    return $this->hasMany(Order::class)
        ->whereIn('status', Order::OCCUPYING_STATUSES);
}

    public function getEffectiveStatusAttribute(): string
    {
        if ($this->status === 'maintenance') {
            return 'maintenance';
        }

        if (! array_key_exists('active_orders_count', $this->attributes)) {
            $this->active_orders_count = $this->activeOrders()->count();
        }

        return $this->active_orders_count > 0 ? 'occupied' : 'available';
    }
}