<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('product_option_groups')) {
            return;
        }

        Schema::table('product_option_groups', function (Blueprint $table) {
            $table->boolean('required')->default(false)->after('selection_type');
            $table->unsignedTinyInteger('min_selections')->default(1)->after('required');
            $table->unsignedTinyInteger('max_selections')->nullable()->after('min_selections');
            $table->unsignedInteger('sort_order')->default(0)->after('max_selections');
        });

        Schema::table('product_options', function (Blueprint $table) {
            if (!Schema::hasColumn('product_options', 'sort_order')) {
                $table->unsignedInteger('sort_order')->default(0)->after('additional_price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_option_groups', function (Blueprint $table) {
            $table->dropColumn(['required', 'min_selections', 'max_selections', 'sort_order']);
        });

        Schema::table('product_options', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
