<?php

namespace App\Services;

use App\Models\RealtimeEvent;

class Realtime
{
    public static function push(string $channel, array $payload = []): void
    {
        RealtimeEvent::create([
            'channel' => $channel,
            'payload' => $payload ?: null,
        ]);
    }
}