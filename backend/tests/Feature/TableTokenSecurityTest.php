<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\RestaurantTable;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TableTokenSecurityTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function makeCategory(): Category
    {
        return Category::create(['name' => 'Makanan', 'is_active' => true]);
    }

    private function makeProduct(Category $cat, int $stock = 100): Product
    {
        return Product::create([
            'category_id' => $cat->id,
            'name' => 'Nasi Goreng',
            'price' => 10000,
            'cost_price' => 5000,
            'stock' => $stock,
            'is_active' => true,
        ]);
    }

    private function makeTable(string $number = '1'): RestaurantTable
    {
        return RestaurantTable::create([
            'table_number' => $number,
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);
    }

    public function test_table_gets_random_public_token(): void
    {
        $table = $this->makeTable();

        $this->assertNotEmpty($table->public_token);
        $this->assertGreaterThanOrEqual(32, strlen($table->public_token));
    }

    public function test_resolve_by_token_returns_checkout_token_without_leaking_public_token(): void
    {
        $table = $this->makeTable('7');

        $res = $this->getJson('/api/tables/resolve/' . $table->public_token);

        $res->assertStatus(200)
            ->assertJsonPath('data.id', $table->id)
            ->assertJsonPath('data.table_number', '7')
            ->assertJsonStructure(['data' => ['checkout_token']]);

        // public_token permanen tidak boleh ikut terkirim.
        $this->assertArrayNotHasKey('public_token', $res->json('data'));
        $this->assertNotSame($table->public_token, $res->json('data.checkout_token'));
    }

    public function test_resolve_unknown_token_returns_404(): void
    {
        $this->getJson('/api/tables/resolve/' . str_repeat('x', 48))->assertStatus(404);
        $this->getJson('/api/tables/resolve/short')->assertStatus(404);
    }

    public function test_checkout_with_valid_checkout_token_succeeds(): void
    {
        $cat = $this->makeCategory();
        $product = $this->makeProduct($cat);
        $table = $this->makeTable();

        $token = $this->getJson('/api/tables/resolve/' . $table->public_token)
            ->json('data.checkout_token');

        $res = $this->postJson('/api/checkout', [
            'checkout_token' => $token,
            'customer_name' => 'Budi',
            'payment_method' => 'cash',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]);

        $res->assertStatus(201);
        $this->assertSame($table->id, $res->json('data.restaurant_table_id'));
    }

    public function test_invalid_checkout_token_does_not_fall_back_to_raw_table_id(): void
    {
        $cat = $this->makeCategory();
        $product = $this->makeProduct($cat);
        $table = $this->makeTable();

        $res = $this->postJson('/api/checkout', [
            'checkout_token' => 'token-palsu',
            // Percobaan bypass: kirim ID mentah yang valid.
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Budi',
            'payment_method' => 'cash',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]);

        $res->assertStatus(422);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_legacy_table_url_still_works_and_hides_public_token(): void
    {
        $table = $this->makeTable('3');

        $res = $this->getJson('/api/restaurant-tables/' . $table->id);

        $res->assertStatus(200)
            ->assertJsonPath('data.id', $table->id)
            ->assertJsonStructure(['data' => ['checkout_token']]);

        $this->assertArrayNotHasKey('public_token', $res->json('data'));
    }

    public function test_active_order_cap_per_table_blocks_excess_orders(): void
    {
        $cat = $this->makeCategory();
        $product = $this->makeProduct($cat, 500);
        $table = $this->makeTable();

        // Cap = 5 pesanan aktif per meja.
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/checkout', [
                'restaurant_table_id' => $table->id,
                'customer_name' => 'Tamu ' . $i,
                'payment_method' => 'cash',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ])->assertStatus(201);
        }

        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Tamu 6',
            'payment_method' => 'cash',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422);

        $this->assertSame(5, \App\Models\Order::where('restaurant_table_id', $table->id)->count());
    }

    public function test_rotating_token_invalidates_old_qr_link(): void
    {
        $admin = \App\Models\User::factory()->create([
            'role' => 'admin',
            'password' => \Illuminate\Support\Facades\Hash::make('Admin123!'),
        ]);
        $auth = ['Authorization' => 'Bearer ' . $admin->createToken('t')->plainTextToken];

        $table = $this->makeTable();
        $oldToken = $table->public_token;

        $this->postJson("/api/restaurant-tables/{$table->id}/rotate-token", [], $auth)
            ->assertStatus(200);

        $this->getJson('/api/tables/resolve/' . $oldToken)->assertStatus(404);
        $this->getJson('/api/tables/resolve/' . $table->fresh()->public_token)->assertStatus(200);
    }
}
