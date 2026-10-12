<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const STATUSES = ['pending', 'confirmed', 'preparing', 'served', 'completed', 'cancelled'];

    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement(
                "ALTER TABLE orders MODIFY status ENUM('pending','confirmed','preparing','served','completed','cancelled') NOT NULL DEFAULT 'pending'"
            );
            return;
        }

        if ($driver === 'sqlite') {
            $this->rebuildOrdersForSqlite();
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement(
                "ALTER TABLE orders MODIFY status ENUM('pending','preparing','served','completed','cancelled') NOT NULL DEFAULT 'pending'"
            );
        }
        // sqlite: biarkan VARCHAR (lebih fleksibel, tidak perlu turun).
    }

    private function rebuildOrdersForSqlite(): void
    {
        DB::statement('PRAGMA foreign_keys=OFF');

        DB::statement('
            CREATE TABLE orders_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                restaurant_table_id BIGINT NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
                order_number VARCHAR(255) NOT NULL UNIQUE,
                tracking_token VARCHAR(64) NULL UNIQUE,
                customer_name VARCHAR(255) NOT NULL,
                subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
                service_charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
                tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
                notes TEXT NULL,
                total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT \'pending\',
                payment_status VARCHAR(20) NOT NULL DEFAULT \'unpaid\',
                payment_method VARCHAR(20) NULL,
                paid_at DATETIME NULL,
                proof_image VARCHAR(255) NULL,
                proof_uploaded_at DATETIME NULL,
                payment_reject_note VARCHAR(500) NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL
            )
        ');

        DB::statement('
            INSERT INTO orders_new
                (id, restaurant_table_id, order_number, tracking_token, customer_name,
                 subtotal, service_charge, tax, notes, total_price, status,
                 payment_status, payment_method, paid_at,
                 proof_image, proof_uploaded_at, payment_reject_note,
                 created_at, updated_at)
            SELECT
                id, restaurant_table_id, order_number, tracking_token, customer_name,
                subtotal, service_charge, tax, notes, total_price, status,
                payment_status, payment_method, paid_at,
                proof_image, proof_uploaded_at, payment_reject_note,
                created_at, updated_at
            FROM orders
        ');

        DB::statement('DROP TABLE orders');
        DB::statement('ALTER TABLE orders_new RENAME TO orders');

        // Kembalikan index performa yang dibuat migrasi sebelumnya.
        $indexes = [
            'orders_status_index' => '(status)',
            'orders_payment_status_index' => '(payment_status)',
            'orders_created_at_index' => '(created_at)',
            'orders_table_status_index' => '(restaurant_table_id, status)',
            'orders_customer_name_index' => '(customer_name)',
            'orders_status_restaurant_table_index' => '(status, restaurant_table_id)',
        ];
        foreach ($indexes as $name => $cols) {
            try {
                DB::statement("CREATE INDEX {$name} ON orders {$cols}");
            } catch (\Exception) {
                // Index mungkin sudah ada / gagal — abaikan agar migrasi tetap jalan.
            }
        }

        DB::statement('PRAGMA foreign_keys=ON');
    }
};
