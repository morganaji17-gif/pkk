<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

class CashierTableClearTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function adminToken(string $role = 'cashier'): array
    {
        $user = User::factory()->create(['role' => $role]);
        return ['Authorization' => 'Bearer ' . $user->createToken('t')->plainTextToken];
    }

    private function setupTableWithOrder(): array
    {
        $cat = Category::create(['name' => 'Makanan', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $cat->id,
            'name' => 'Nasi Goreng',
            'price' => 10000,
            'cost_price' => 5000,
            'stock' => 50,
            'is_active' => true,
        ]);
        $table = RestaurantTable::create([
            'table_number' => '5',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        $order = $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Budi',
            'payment_method' => 'cash',
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])->assertStatus(201)->json('data');

        return [$table, $order, $product];
    }

    private function markOrderPaid(array $order): void
    {
        Order::find($order['id'])->update([
            'payment_status' => 'paid',
            'paid_at' => now(),
        ]);
    }

    public function test_cashier_can_clear_occupied_table(): void
    {
        [$table, $order, $product] = $this->setupTableWithOrder();
        $this->markOrderPaid($order);
        $auth = $this->adminToken('cashier');

        // Pastikan meja terisi.
        $this->getJson('/api/restaurant-tables', $auth)
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $table->id, 'active_orders_count' => 1]);

        $res = $this->postJson("/api/restaurant-tables/{$table->id}/clear", [], $auth);

        $res->assertStatus(200)->assertJsonPath('data.cleared_orders', 1);

        // Pesanan aktif selesai, bukan dibatalkan → stok tetap terpakai.
        $this->assertSame('completed', Order::find($order['id'])->status);
        $this->assertSame(48, $product->fresh()->stock);
        $this->assertSame(0, $table->fresh()->activeOrdersCount());
    }

    public function test_clearing_table_without_active_orders_is_noop(): void
    {
        $table = RestaurantTable::create([
            'table_number' => '9',
            'capacity' => 2,
            'status' => 'available',
            'is_available' => true,
        ]);
        $auth = $this->adminToken('cashier');

        $this->postJson("/api/restaurant-tables/{$table->id}/clear", [], $auth)
            ->assertStatus(200)
            ->assertJsonPath('data.cleared_orders', 0);
    }

    public function test_kitchen_cannot_clear_table(): void
    {
        [$table] = $this->setupTableWithOrder();
        $auth = $this->adminToken('kitchen');

        $this->postJson("/api/restaurant-tables/{$table->id}/clear", [], $auth)
            ->assertStatus(403);
    }

    public function test_guest_cannot_clear_table(): void
    {
        [$table] = $this->setupTableWithOrder();

        $this->postJson("/api/restaurant-tables/{$table->id}/clear")
            ->assertStatus(401);
    }

    public function test_cashier_cannot_clear_table_with_unpaid_orders(): void
    {
        [$table, $order] = $this->setupTableWithOrder();
        $auth = $this->adminToken('cashier');
        // Order tetap unpaid → guard harus menolak.
        $this->postJson("/api/restaurant-tables/{$table->id}/clear", [], $auth)
            ->assertStatus(422)
            ->assertJsonPath('errors.table.0', '1 pesanan belum dibayar — selesaikan pembayaran sebelum mengosongkan meja.');
    }
}
