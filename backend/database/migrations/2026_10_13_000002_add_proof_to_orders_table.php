<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('proof_image')->nullable()->after('paid_at');
            $table->timestamp('proof_uploaded_at')->nullable()->after('proof_image');
            $table->string('payment_reject_note', 500)->nullable()->after('proof_uploaded_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['proof_image', 'proof_uploaded_at', 'payment_reject_note']);
        });
    }
};
