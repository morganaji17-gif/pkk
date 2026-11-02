<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Snapshot pilihan varian/opsi saat item dipesan
        // (mis. Level Pedas 5, Ukuran L). JSON per item.
        Schema::table('order_items', function (Blueprint $table) {
            $table->json('selected_options')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('selected_options');
        });
    }
};
