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
            DB::statement("ALTER TABLE users MODIFY role VARCHAR(20) NOT NULL");
            return;
        }

        if ($driver === 'sqlite') {
            // SQLite menyimpan enum sebagai CHECK constraint.
            // Bangun ulang tabel tanpa CHECK agar role kitchen lolos.
            DB::statement('PRAGMA foreign_keys=OFF');

            DB::statement('
                CREATE TABLE users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    email_verified_at DATETIME NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    remember_token VARCHAR(100) NULL,
                    created_at DATETIME NULL,
                    updated_at DATETIME NULL
                )
            ');

            DB::statement('
                INSERT INTO users_new (id, name, email, email_verified_at, password, role, remember_token, created_at, updated_at)
                SELECT id, name, email, email_verified_at, password, role, remember_token, created_at, updated_at FROM users
            ');

            DB::statement('DROP TABLE users');
            DB::statement('ALTER TABLE users_new RENAME TO users');

            DB::statement('PRAGMA foreign_keys=ON');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY role ENUM('admin','cashier') NOT NULL");
        }
        // sqlite: biarkan string (lebih fleksibel).
    }
};
