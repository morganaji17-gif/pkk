<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (app()->environment('testing') && \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'sqlite') {
            return;
        }
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign('order_items_product_id_foreign');
            $table->foreign('product_id')
                ->references('id')
                ->on('products')
                ->restrictOnDelete();
        });

        Schema::table('stock_mutations', function (Blueprint $table) {
            $table->dropForeign('stock_mutations_product_id_foreign');
            $table->foreign('product_id')
                ->references('id')
                ->on('products')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (app()->environment('testing') && \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'sqlite') {
            return;
        }
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign('order_items_product_id_foreign');
            $table->foreign('product_id')
                ->references('id')
                ->on('products')
                ->cascadeOnDelete();
        });

        Schema::table('stock_mutations', function (Blueprint $table) {
            $table->dropForeign('stock_mutations_product_id_foreign');
            $table->foreign('product_id')
                ->references('id')
                ->on('products')
                ->cascadeOnDelete();
        });
    }
};
