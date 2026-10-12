<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->index('created_at', 'products_created_at_index');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->index('created_at', 'categories_created_at_index');
        });

        Schema::table('restaurant_tables', function (Blueprint $table) {
            $table->index('created_at', 'restaurant_tables_created_at_index');
            $table->index('status', 'restaurant_tables_status_index');
            $table->index('is_available', 'restaurant_tables_is_available_index');
        });

        Schema::table('stock_mutations', function (Blueprint $table) {
            $table->index('reason', 'stock_mutations_reason_index');
            $table->index('created_at', 'stock_mutations_created_at_index');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->index('customer_name', 'orders_customer_name_index');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_created_at_index');
        });
        Schema::table('categories', function (Blueprint $table) {
            $table->dropIndex('categories_created_at_index');
        });
        Schema::table('restaurant_tables', function (Blueprint $table) {
            $table->dropIndex('restaurant_tables_created_at_index');
            $table->dropIndex('restaurant_tables_status_index');
            $table->dropIndex('restaurant_tables_is_available_index');
        });
        Schema::table('stock_mutations', function (Blueprint $table) {
            $table->dropIndex('stock_mutations_reason_index');
            $table->dropIndex('stock_mutations_created_at_index');
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_customer_name_index');
        });
    }
};
