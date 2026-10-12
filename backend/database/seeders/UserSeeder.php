<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // GANTI password ini via .env untuk produksi. Default hanya untuk lokal/sekolah.
        $adminPassword = env('SEED_ADMIN_PASSWORD', 'Admin123!');
        $cashierPassword = env('SEED_CASHIER_PASSWORD', 'Cashier123!');
        $kitchenPassword = env('SEED_KITCHEN_PASSWORD', 'Kitchen123!');

        User::updateOrCreate(
            [
                'email' => 'admin@example.com',
            ],
            [
                'name' => 'Admin',
                'password' => $adminPassword,
                'role' => 'admin',
            ]
        );

        User::updateOrCreate(
            [
                'email' => 'cashier@example.com',
            ],
            [
                'name' => 'Cashier',
                'password' => $cashierPassword,
                'role' => 'cashier',
            ]
        );

        User::updateOrCreate(
            [
                'email' => 'kitchen@example.com',
            ],
            [
                'name' => 'Dapur',
                'password' => $kitchenPassword,
                'role' => 'kitchen',
            ]
        );
    }
}
