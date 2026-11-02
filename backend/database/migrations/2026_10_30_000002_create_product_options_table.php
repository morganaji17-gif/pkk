<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('option_group_id')->constrained('product_option_groups')->cascadeOnDelete()->cascadeOnUpdate();
            $table->string('label', 100);
            $table->decimal('additional_price', 10, 2)->default(0);
            $table->timestamps();

            $table->index(['option_group_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_options');
    }
};
