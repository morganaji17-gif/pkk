<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class KdsTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role): User
    {
        return User::factory()->create(['role' => $role, 'password' => Hash::make('Pass123!')]);
    }

    private function seedOrder(): Order
    {
        $suffix = Str::random(6);
        $cat = Category::create(['name' => 'Cat-' . $suffix, 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Menu-' . $suffix,
            'price' => 12000,
            'stock' => 20,
            'is_active' => true,
        ]);
        $table = RestaurantTable::create([
            'table_number' => 'T-' . $suffix,
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'KDS',
            'payment_method' => 'cash',
            'items' => [['product_id' => $prod->id, 'quantity' => 1]],
        ])->assertStatus(201);

        return Order::first();
    }

    /**
     * Header auth segar per request. Wajib forgetGuards karena
     * instance aplikasi dipakai ulang antar request dalam satu test,
     * sehingga guard Sanctum bisa meng-cache user dari request sebelumnya.
     */
    private function authHeaders(User $user): array
    {
        app('auth')->forgetGuards();
        $token = $user->createToken('t-' . Str::random(4))->plainTextToken;

        return ['Authorization' => "Bearer $token"];
    }

    private function patchStatus(Order $order, User $user, string $status)
    {
        return $this->patchJson(
            "/api/orders/{$order->id}/status",
            ['status' => $status],
            $this->authHeaders($user)
        );
    }

    public function test_cashier_confirms_pending_to_confirmed_but_cannot_cook()
    {
        $order = $this->seedOrder();
        $cashier = $this->makeUser('cashier');

        $this->patchStatus($order, $cashier, 'confirmed')->assertStatus(200);

        // kasir tidak boleh aksi dapur
        $this->patchStatus($order, $cashier, 'preparing')->assertStatus(403);
    }

    public function test_kitchen_gate_requires_confirmed()
    {
        $order = $this->seedOrder();
        $kitchen = $this->makeUser('kitchen');
        $cashier = $this->makeUser('cashier');

        // pending langsung ke preparing ditolak (belum diterima kasir, transisi tidak valid)
        $this->patchStatus($order, $kitchen, 'preparing')->assertStatus(422);

        // setelah confirmed baru bisa
        $this->patchStatus($order, $cashier, 'confirmed')->assertStatus(200);

        $this->patchStatus($order, $kitchen, 'preparing')->assertStatus(200);
        $this->patchStatus($order, $kitchen, 'served')->assertStatus(200);
        $this->patchStatus($order, $kitchen, 'completed')->assertStatus(200);
    }

    public function test_payment_does_not_auto_change_kitchen_status()
    {
        $order = $this->seedOrder();
        $cashier = $this->makeUser('cashier');

        $this->assertEquals('pending', $order->fresh()->status);

        $this->patchJson(
            "/api/orders/{$order->id}/payment",
            ['action' => 'confirm'],
            $this->authHeaders($cashier)
        )->assertStatus(200);

        // status dapur tetap pending, tidak meloncat ke confirmed/preparing
        $this->assertEquals('pending', $order->fresh()->status);
        $this->assertEquals('paid', $order->fresh()->payment_status);
    }

    public function test_kitchen_cannot_cancel_or_pay()
    {
        $order = $this->seedOrder();
        $kitchen = $this->makeUser('kitchen');

        $this->patchStatus($order, $kitchen, 'cancelled')->assertStatus(403);
        $this->patchJson(
            "/api/orders/{$order->id}/payment",
            ['action' => 'confirm'],
            $this->authHeaders($kitchen)
        )->assertStatus(403);
    }

    public function test_admin_full_kds_flow()
    {
        $order = $this->seedOrder();
        $admin = $this->makeUser('admin');

        foreach (['confirmed', 'preparing', 'served', 'completed'] as $next) {
            $this->patchStatus($order, $admin, $next)->assertStatus(200);
        }
        $this->assertEquals('completed', $order->fresh()->status);
    }
}
