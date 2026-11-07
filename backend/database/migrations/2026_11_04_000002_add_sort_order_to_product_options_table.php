<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('product_options')) {
            return;
        }

        if (Schema::hasColumn('product_options', 'sort_order')) {
            return;
        }

        Schema::table('product_options', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('additional_price');
        });
    }

    public function down(): void
    {
        Schema::table('product_options', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
