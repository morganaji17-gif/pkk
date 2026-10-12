<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('tracking_token', 64)->nullable()->unique()->after('order_number');
        });

        DB::table('orders')->whereNull('tracking_token')->orderBy('id')->chunkById(500, function ($orders) {
            foreach ($orders as $order) {
                DB::table('orders')
                    ->where('id', $order->id)
                    ->update(['tracking_token' => bin2hex(random_bytes(32))]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['tracking_token']);
            $table->dropColumn('tracking_token');
        });
    }
};
