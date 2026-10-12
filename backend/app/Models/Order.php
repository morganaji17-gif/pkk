<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    public const OCCUPYING_STATUSES = ['pending', 'confirmed', 'preparing', 'served'];

    public const APPENDABLE_STATUSES = ['pending', 'confirmed', 'preparing'];

    public const STATUSES = ['pending', 'confirmed', 'preparing', 'served', 'completed', 'cancelled'];

    /**
     * Transisi status yang diizinkan (state machine sederhana).
     * Kasir: pending -> confirmed. Dapur: confirmed -> preparing -> served.
     * Penyajian: served -> completed. Pembatalan dari status aktif.
     */
    public const STATUS_TRANSITIONS = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['preparing', 'cancelled'],
        'preparing' => ['served', 'cancelled'],
        'served' => ['completed', 'cancelled'],
        'completed' => [],
        'cancelled' => [],
    ];

    /**
     * Aksi dapur saja (KDS). served di UI = READY.
     */
    public const KITCHEN_TRANSITIONS = [
        'confirmed' => ['preparing'],
        'preparing' => ['served'],
        'served' => ['completed'],
    ];

    /**
     * Aksi kasir saja (di luar pembayaran). Dapur dikerjakan kitchen.
     */
    public const CASHIER_TRANSITIONS = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['cancelled'],
        'preparing' => ['cancelled'],
        'served' => ['completed', 'cancelled'],
    ];

    protected $fillable = [
        'restaurant_table_id',
        'order_number',
        'tracking_token',
        'customer_name',
        'subtotal',
        'service_charge',
        'tax',
        'notes',
        'total_price',
        'status',
        'payment_status',
        'payment_method',
        'paid_at',
        'proof_image',
        'proof_uploaded_at',
        'payment_reject_note',
    ];

    protected $casts = [
        'total_price' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'service_charge' => 'decimal:2',
        'tax' => 'decimal:2',
        'paid_at' => 'datetime',
        'proof_uploaded_at' => 'datetime',
    ];

    protected $appends = [
        'proof_url',
    ];

    public function getProofUrlAttribute(): ?string
    {
        if (empty($this->proof_image)) {
            return null;
        }

        return \Illuminate\Support\Facades\Storage::url($this->proof_image);
    }

    protected static function booted(): void
    {
        static::creating(function (Order $order) {
            if (empty($order->tracking_token)) {
                $order->tracking_token = bin2hex(random_bytes(32));
            }
            if (empty($order->order_number)) {
                $order->order_number = static::generateOrderNumber();
            }
        });
    }

    public static function generateOrderNumber(): string
    {
        return 'ORD-' . now()->format('Ymd') . '-' . strtoupper(\Illuminate\Support\Str::random(6));
    }

    public static function generateTrackingToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    public function table()
{
    return $this->belongsTo(RestaurantTable::class,'restaurant_table_id');
}

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }
}
