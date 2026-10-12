<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RealtimeEvent extends Model
{
    protected $fillable = [
        'channel',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];
}