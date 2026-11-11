<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Index (channel, id) sudah ada di migration 2026_10_05_000001.
     * Migration ini hanya menambah index created_at untuk cleanup berbasis umur.
     */
    public function up(): void
    {
        Schema::table('realtime_events', function (Blueprint $table) {
            $table->index('created_at', 'realtime_events_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('realtime_events', function (Blueprint $table) {
            $table->dropIndex('realtime_events_created_at_index');
        });
    }
};
