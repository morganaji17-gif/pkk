<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('realtime_events', function (Blueprint $table) {
            $table->id();
            $table->string('channel', 80);
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['channel', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('realtime_events');
    }
};