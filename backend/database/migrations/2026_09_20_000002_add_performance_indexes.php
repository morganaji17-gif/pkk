<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->index('status', 'orders_status_index');
            $table->index('payment_status', 'orders_payment_status_index');
            $table->index('created_at', 'orders_created_at_index');
            $table->index(['restaurant_table_id', 'status'], 'orders_table_status_index');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->index(['is_active', 'stock'], 'products_active_stock_index');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index('action', 'audit_logs_action_index');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_status_index');
            $table->dropIndex('orders_payment_status_index');
            $table->dropIndex('orders_created_at_index');
            $table->dropIndex('orders_table_status_index');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_active_stock_index');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_action_index');
        });
    }
};
