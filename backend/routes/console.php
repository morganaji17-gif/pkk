<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Hapus event realtime yang lebih dari 15 menit
// (cukup untuk polling 2 detik × beberapa client per meja).
// Dijadwalkan setiap menit; jauh lebih hemat DB daripada retensi 1 jam.
Schedule::call(function () {
    \App\Models\RealtimeEvent::where('created_at', '<', now()->subMinutes(15))->delete();
})->everyMinute();
