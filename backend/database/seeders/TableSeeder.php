<?php

namespace Database\Seeders;

use App\Models\RestaurantTable;
use Illuminate\Database\Seeder;

class TableSeeder extends Seeder
{
    public function run(): void
    {
        $tables = [
            ['table_number' => '1', 'capacity' => 4, 'status' => 'available', 'is_available' => true],
            ['table_number' => '2', 'capacity' => 4, 'status' => 'available', 'is_available' => true],
            ['table_number' => '3', 'capacity' => 6, 'status' => 'available', 'is_available' => true],
            ['table_number' => '4', 'capacity' => 6, 'status' => 'available', 'is_available' => true],
            ['table_number' => '5', 'capacity' => 2, 'status' => 'available', 'is_available' => true],
            ['table_number' => '6', 'capacity' => 2, 'status' => 'available', 'is_available' => true],
        ];

        foreach ($tables as $table) {
            RestaurantTable::updateOrCreate(
                ['table_number' => $table['table_number']],
                $table
            );
        }
    }
}
