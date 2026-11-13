<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class RestaurantTable extends Model
{
    protected $fillable = [
    'table_number',
    'capacity',
    'qr_code',
    'is_available',
    'status',
    ];

    /**
     * public_token sengaja TIDAK fillable: hanya dibuat oleh sistem
     * agar tidak bisa di-set dari payload admin.
     */
    protected $casts = [
        'is_available' => 'boolean',
    ];

    protected $appends = [
        'effective_status',
    ];

    protected static function booted(): void
    {
        static::creating(function (RestaurantTable $table) {
            if (empty($table->public_token)) {
                $table->public_token = Str::random(48);
            }
        });
    }

    public function orders()
{
    return $this->hasMany(Order::class);
}

    public function activeOrders()
{
    return $this->hasMany(Order::class)
        ->whereIn('status', Order::OCCUPYING_STATUSES);
}

    /**
     * Hitung pesanan aktif (belum selesai). Dipakai untuk membatasi spam
     * pesanan palsu per meja.
     */
    public function activeOrdersCount(): int
    {
        return $this->activeOrders()->count();
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
