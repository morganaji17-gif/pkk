<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY role ENUM('admin','cashier','kitchen') NOT NULL");
            return;
        }

        // SQLite / pgsql: enum tidak di-enforce, validasi ditangani FormRequest.
        // Tidak ada perubahan skema yang diperlukan.
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            // Kembalikan ke semula. Gagal jika masih ada user kitchen.
            DB::statement("ALTER TABLE users MODIFY role ENUM('admin','cashier') NOT NULL");
        }
    }
};
