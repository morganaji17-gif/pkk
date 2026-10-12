<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class KitchenAndPaymentTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role)
    {
        return User::factory()->create(['role' => $role, 'password' => Hash::make('Pass123!')]);
    }

    private function seedOrder(string $paymentMethod = 'cash', int $stock = 10, int $qty = 1): array
    {
        $suffix = \Illuminate\Support\Str::random(6);
        $cat = Category::create(['name' => 'Cat-' . $suffix, 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Nasi Goreng-' . $suffix,
            'price' => 15000,
            'cost_price' => 8000,
            'stock' => $stock,
            'is_active' => true,
        ]);
        $table = RestaurantTable::create(['table_number' => 'T-' . $suffix, 'capacity' => 4, 'status' => 'available', 'is_available' => true]);

        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Budi',
            'payment_method' => $paymentMethod,
            'items' => [['product_id' => $prod->id, 'quantity' => $qty]],
        ]);
        $res->assertStatus(201);

        return [Order::latest('id')->first(), $prod, $table];
    }

    private function token(User $user): string
    {
        app('auth')->forgetGuards();
        return $user->createToken('t-' . \Illuminate\Support\Str::random(4))->plainTextToken;
    }

    private function patchStatusAs(\App\Models\Order $order, User $user, string $status)
    {
        app('auth')->forgetGuards();
        $token = $user->createToken('t-' . \Illuminate\Support\Str::random(4))->plainTextToken;

        return $this->patchJson(
            "/api/orders/{$order->id}/status",
            ['status' => $status],
            ['Authorization' => "Bearer $token"]
        );
    }

    public function test_admin_can_update_status_and_payment()
    {
        [$order] = $this->seedOrder('cash');
        $admin = $this->makeUser('admin');
        $t = $this->token($admin);

        $this->patchJson("/api/orders/{$order->id}/status", ['status' => 'confirmed'], ['Authorization' => "Bearer $t"])
            ->assertStatus(200);

        $this->patchJson("/api/orders/{$order->id}/payment", ['action' => 'confirm'], ['Authorization' => "Bearer $t"])
            ->assertStatus(200);

        $this->assertEquals('paid', $order->fresh()->payment_status);
    }

    public function test_kitchen_status_limited_and_no_payment_or_reports()
    {
        [$order] = $this->seedOrder('cash');
        $cashier = $this->makeUser('cashier');
        // kasir terima dulu agar masuk kolom NEW dapur
        $this->patchStatusAs($order, $cashier, 'confirmed')->assertStatus(200);

        $kitchen = $this->makeUser('kitchen');

        // boleh confirmed -> preparing
        $this->patchStatusAs($order, $kitchen, 'preparing')->assertStatus(200);

        // boleh preparing -> served (siap)
        $this->patchStatusAs($order, $kitchen, 'served')->assertStatus(200);

        // boleh served -> completed (keputusan: kitchen boleh selesaikan)
        $this->patchStatusAs($order, $kitchen, 'completed')->assertStatus(200);

        // tidak boleh cancel
        [$order2] = $this->seedOrder('cash');
        $this->patchStatusAs($order2, $kitchen, 'cancelled')->assertStatus(403);

        // tidak boleh payment
        app('auth')->forgetGuards();
        $kt = $kitchen->createToken('t-' . \Illuminate\Support\Str::random(4))->plainTextToken;
        $this->patchJson("/api/orders/{$order2->id}/payment", ['action' => 'confirm'], ['Authorization' => "Bearer $kt"])
            ->assertStatus(403);

        // tidak boleh laporan
        $this->getJson('/api/reports/sales?period=day&date=' . now()->format('Y-m-d'), ['Authorization' => "Bearer $kt"])
            ->assertStatus(403);

        // boleh lihat orders + dashboard
        $this->getJson('/api/orders', ['Authorization' => "Bearer $kt"])->assertStatus(200);
        $this->getJson('/api/dashboard/stats', ['Authorization' => "Bearer $kt"])->assertStatus(200);
    }

    public function test_qris_payment_requires_proof_then_confirm_and_reject()
    {
        Storage::fake('public');
        [$order] = $this->seedOrder('qris');
        $cashier = $this->makeUser('cashier');
        $t = $this->token($cashier);

        // confirm tanpa bukti harus 422
        $this->patchJson("/api/orders/{$order->id}/payment", ['action' => 'confirm'], ['Authorization' => "Bearer $t"])
            ->assertStatus(422);

        // upload bukti via tracking token (public)
        $file = UploadedFile::fake()->image('bukti.jpg', 800, 800)->size(500);
        $this->postJson("/api/orders/track/{$order->tracking_token}/proof", ['proof' => $file])
            ->assertStatus(200);
        $this->assertNotNull($order->fresh()->proof_image);

        // confirm sekarang sukses
        $this->patchJson("/api/orders/{$order->id}/payment", ['action' => 'confirm'], ['Authorization' => "Bearer $t"])
            ->assertStatus(200);
        $this->assertEquals('paid', $order->fresh()->payment_status);
    }

    public function test_reject_proof_clears_image()
    {
        Storage::fake('public');
        [$order] = $this->seedOrder('qris');
        $cashier = $this->makeUser('cashier');
        $t = $this->token($cashier);

        $file = UploadedFile::fake()->image('bukti.jpg', 800, 800)->size(500);
        $this->postJson("/api/orders/track/{$order->tracking_token}/proof", ['proof' => $file])
            ->assertStatus(200);

        $this->patchJson(
            "/api/orders/{$order->id}/payment",
            ['action' => 'reject', 'reject_note' => 'Foto buram'],
            ['Authorization' => "Bearer $t"]
        )->assertStatus(200);

        $fresh = $order->fresh();
        $this->assertNull($fresh->proof_image);
        $this->assertEquals('Foto buram', $fresh->payment_reject_note);
        $this->assertEquals('unpaid', $fresh->payment_status);
    }

    public function test_cash_payment_without_proof_still_works()
    {
        [$order] = $this->seedOrder('cash');
        $cashier = $this->makeUser('cashier');
        $t = $this->token($cashier);

        $this->patchJson("/api/orders/{$order->id}/payment", ['action' => 'confirm'], ['Authorization' => "Bearer $t"])
            ->assertStatus(200);
    }

    public function test_dashboard_stats_has_new_fields()
    {
        $this->seedOrder('cash');
        $admin = $this->makeUser('admin');
        $t = $this->token($admin);

        $res = $this->getJson('/api/dashboard/stats', ['Authorization' => "Bearer $t"]);
        $res->assertStatus(200);
        $res->assertJsonStructure(['data' => [
            'pending_orders', 'confirmed_orders', 'preparing_orders', 'ready_orders',
            'unpaid_orders', 'pending_proofs',
            'today_revenue', 'today_transactions', 'today_average',
        ]]);
    }

    public function test_checkout_sequential_depletes_stock_second_fails()
    {
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Ayam',
            'price' => 10000,
            'stock' => 2,
            'is_active' => true,
        ]);
        $table = RestaurantTable::create(['table_number' => '9', 'capacity' => 4, 'status' => 'available', 'is_available' => true]);

        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'A',
            'payment_method' => 'cash',
            'items' => [['product_id' => $prod->id, 'quantity' => 2]],
        ])->assertStatus(201);
        $this->assertEquals(0, $prod->fresh()->stock);

        // stok habis, checkout berikutnya harus 422 bukan 500
        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'B',
            'payment_method' => 'cash',
            'items' => [['product_id' => $prod->id, 'quantity' => 1]],
        ])->assertStatus(422);
    }

    public function test_kitchen_user_can_be_created_via_api()
    {
        $admin = $this->makeUser('admin');
        $t = $this->token($admin);

        $this->postJson('/api/users', [
            'name' => 'Dapur Satu',
            'email' => 'dapur@example.com',
            'password' => 'Dapur123!',
            'role' => 'kitchen',
        ], ['Authorization' => "Bearer $t"])->assertStatus(201);

        $this->assertDatabaseHas('users', ['email' => 'dapur@example.com', 'role' => 'kitchen']);
    }
}
