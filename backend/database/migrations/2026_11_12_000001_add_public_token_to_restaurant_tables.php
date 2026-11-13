<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Token publik per meja untuk URL QR.
     * Menggantikan ID berurutan (?table=1) agar tidak mudah ditebak/dienumerasi.
     */
    public function up(): void
    {
        Schema::table('restaurant_tables', function (Blueprint $table) {
            $table->string('public_token', 64)->nullable()->unique()->after('table_number');
        });

        // Backfill token untuk meja yang sudah ada.
        DB::table('restaurant_tables')
            ->whereNull('public_token')
            ->orderBy('id')
            ->each(function ($row) {
                DB::table('restaurant_tables')
                    ->where('id', $row->id)
                    ->update(['public_token' => Str::random(48)]);
            });
    }

    public function down(): void
    {
        Schema::table('restaurant_tables', function (Blueprint $table) {
            $table->dropUnique(['public_token']);
            $table->dropColumn('public_token');
        });
    }
};
