<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('subtotal', 12, 2)->default(0)->after('customer_name');
            $table->decimal('service_charge', 12, 2)->default(0)->after('subtotal');
            $table->decimal('tax', 12, 2)->default(0)->after('service_charge');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['subtotal', 'service_charge', 'tax']);
        });
    }
};