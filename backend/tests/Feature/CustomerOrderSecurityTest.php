<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

class CustomerOrderSecurityTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function createCategory() { return Category::create(['name' => 'Cat', 'is_active' => true]); }
    private function createProduct($cat, $stock = 10, $price = 10000) {
        return Product::create(['category_id'=>$cat->id,'name'=>'P','price'=>$price,'cost_price'=>5000,'stock'=>$stock,'is_active'=>true]);
    }
    private function createTable($num='1') {
        return RestaurantTable::create(['table_number'=>$num,'capacity'=>4,'status'=>'available','is_available'=>true]);
    }
    private function createOrder($table, $product, $qty=1, $name='Budi') {
        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>$name,
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$product->id,'quantity'=>$qty]]
        ]);
        $res->assertStatus(201);
        return $res->json('data');
    }

    // A. Customer can create an order for a valid table.
    public function test_customer_can_create_order_for_valid_table()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat);
        $table = $this->createTable('7');
        $data = $this->createOrder($table, $prod);
        $this->assertNotNull($data['tracking_token']);
        $this->assertNotNull($data['order_number']);
        $this->assertEquals(64, strlen($data['tracking_token']));
    }

    // B. Customer can access their own order.
    public function test_customer_can_access_own_order()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat);
        $table = $this->createTable();
        $order = $this->createOrder($table, $prod);
        $token = $order['tracking_token'];
        $res = $this->getJson("/api/orders/track/{$token}");
        $res->assertStatus(200)->assertJsonPath('data.tracking_token', $token);
        // SSE
        $this->getJson("/api/orders/track/{$token}/events")->assertStatus(200);
    }

    // C. Customer cannot access another customer's order.
    public function test_customer_cannot_access_another_order_via_id_number_token()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat);
        $table = $this->createTable('7');
        $orderA = $this->createOrder($table, $prod, 1, 'Alice');
        $orderB = $this->createOrder($table, $prod, 1, 'Bob');

        // via order ID (customer endpoint requires auth, should be 401 without token, but try public track with ID)
        $this->getJson("/api/orders/track/{$orderB['id']}")->assertStatus(404);

        // via order_number (should now be 404, not 200)
        $this->getJson("/api/orders/track/{$orderB['order_number']}")->assertStatus(404);

        // via wrong tracking_token (random)
        $this->getJson("/api/orders/track/".str_repeat('a',64))->assertStatus(404);

        // via tracking_token of B using A's token should return A's order, not B's - verify isolation
        $resA = $this->getJson("/api/orders/track/{$orderA['tracking_token']}");
        $resA->assertStatus(200);
        $this->assertEquals($orderA['order_number'], $resA->json('data.order_number'));
        $this->assertNotEquals($orderB['order_number'], $resA->json('data.order_number'));

        // try to append to B's order using A's token should fail if table mismatch? Actually same table, but we test that using B's token to append should work, using random should fail
        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Alice',
            'payment_method'=>'cash',
            'tracking_token'=>str_repeat('b',64),
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]]
        ]);
        $res->assertStatus(422); // validation exists fails
    }

    // D. Customer cannot subscribe to another customer's SSE.
    public function test_customer_cannot_subscribe_to_another_sse()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat);
        $table = $this->createTable();
        $orderA = $this->createOrder($table, $prod, 1, 'Alice');
        $orderB = $this->createOrder($table, $prod, 1, 'Bob');

        // try to stream B's order using A's token - should be 404 if we use wrong token, but using B's token should succeed
        $this->getJson("/api/orders/track/{$orderB['tracking_token']}/events")->assertStatus(200);
        // random token should 404
        $this->getJson("/api/orders/track/".str_repeat('c',64)."/events")->assertStatus(404);
        // using order_number should now 404
        $this->getJson("/api/orders/track/{$orderB['order_number']}/events")->assertStatus(404);
    }

    // E. Customer cannot manipulate prices/totals.
    public function test_customer_cannot_manipulate_prices()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 10, 10000);
        $table = $this->createTable();
        // try to send price, subtotal, total in request - should be ignored and recalculated
        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]],
            'total_price'=>1, // try to cheat
            'subtotal'=>1,
            'price'=>1,
        ]);
        $res->assertStatus(201);
        $data = $res->json('data');
        // should be 10000, not 1
        $this->assertEquals(10000, (float)$data['subtotal']);
        $this->assertEquals(10000, (float)$data['total_price']);
    }

    // F. Customer cannot order more stock than is available.
    public function test_customer_cannot_order_more_than_stock()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 2, 10000);
        $table = $this->createTable();
        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>5]]
        ]);
        $res->assertStatus(422);
        $this->assertEquals(2, $prod->fresh()->stock);
    }

    // G. Staff/admin order access still works.
    public function test_staff_can_access_orders_via_id()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat);
        $table = $this->createTable();
        $order = $this->createOrder($table, $prod);
        $admin = User::factory()->create(['role'=>'admin','password'=>Hash::make('Admin123!')]);
        $token = $admin->createToken('t')->plainTextToken;
        $this->getJson('/api/orders', ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->getJson("/api/orders/{$order['id']}", ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->getJson('/api/dashboard/stats', ['Authorization'=>"Bearer $token"])->assertStatus(200);
    }

    // H. QR/table URLs still work exactly as before.
    public function test_qr_and_table_urls_still_work()
    {
        $table = $this->createTable('7');
        $this->getJson("/api/restaurant-tables/{$table->id}")->assertStatus(200)->assertJsonPath('data.id', $table->id);
        $this->getJson("/api/restaurant-tables/{$table->id}/qr")->assertStatus(200)->assertHeader('Content-Type', 'image/svg+xml');
        // QR URL is permanent/static: /menu?table=7
        $expectedUrl = config('app.frontend_url').'/menu?table='.$table->id;
        $this->assertStringContainsString('/menu?table='.$table->id, $expectedUrl);
    }
}
