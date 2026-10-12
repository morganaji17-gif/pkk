<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Hash;

class RegressionP0Test extends \Tests\TestCase
{
    use RefreshDatabase;

    private function admin()
    {
        return User::factory()->create(['role' => 'admin', 'password' => Hash::make('Admin123!')]);
    }

    private function cashier()
    {
        return User::factory()->create(['role' => 'cashier', 'password' => Hash::make('Cashier123!')]);
    }

    private function createCategory()
    {
        return Category::create(['name' => 'TestCat', 'description' => 'desc', 'is_active' => true]);
    }

    private function createProduct($category, $stock = 50, $price = 15000)
    {
        return Product::create([
            'category_id' => $category->id,
            'name' => 'Mie Ayam',
            'price' => $price,
            'cost_price' => 8000,
            'stock' => $stock,
            'is_active' => true,
        ]);
    }

    private function createTable()
    {
        return RestaurantTable::create(['table_number' => '1', 'capacity' => 4, 'status' => 'available', 'is_available' => true]);
    }

    public function test_auth_login_success()
    {
        $admin = $this->admin();
        $res = $this->postJson('/api/login', ['email' => $admin->email, 'password' => 'Admin123!']);
        $res->assertStatus(200)->assertJsonStructure(['token','user']);
    }

    public function test_auth_invalid_login()
    {
        $admin = $this->admin();
        $res = $this->postJson('/api/login', ['email' => $admin->email, 'password' => 'wrong']);
        $res->assertStatus(401);
    }

    public function test_auth_me_and_logout()
    {
        $admin = $this->admin();
        $token = $admin->createToken('test')->plainTextToken;
        $this->getJson('/api/me', ['Authorization' => "Bearer $token"])->assertStatus(200);
        $this->postJson('/api/logout', [], ['Authorization' => "Bearer $token"])->assertStatus(200);
        $this->assertEquals(0, \Illuminate\Support\Facades\DB::table('personal_access_tokens')->where('tokenable_id', $admin->id)->count());
        // clear auth state between requests
        app('auth')->forgetGuards();
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_product_pagination_and_search()
    {
        $cat = $this->createCategory();
        for ($i=0;$i<5;$i++) $this->createProduct($cat, 10+$i, 10000+$i);
        $res = $this->getJson('/api/products?per_page=2&page=1');
        $res->assertStatus(200)->assertJsonStructure(['data','meta']);
        $this->assertCount(2, $res->json('data'));
        $this->assertEquals(5, $res->json('meta.total'));
        // search
        $this->getJson('/api/products?search=Mie')->assertStatus(200);
    }

    public function test_category_pagination()
    {
        for($i=0;$i<3;$i++) Category::create(['name'=>"Cat$i",'is_active'=>true]);
        $res = $this->getJson('/api/categories?per_page=2');
        $res->assertStatus(200)->assertJsonStructure(['data','meta']);
    }

    public function test_table_occupied_status()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $table = $this->createTable();
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 10);
        // create order to occupy table
        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Budi',
            'payment_method' => 'cash',
            'items' => [['product_id'=>$prod->id,'quantity'=>1]]
        ])->assertStatus(201);
        $res = $this->getJson('/api/restaurant-tables', ['Authorization'=>"Bearer $token"]);
        $res->assertStatus(200);
        $data = $res->json('data');
        $found = collect($data)->firstWhere('id',$table->id);
        $this->assertEquals('occupied', $found['effective_status']);
    }

    public function test_checkout_and_stock_decrement()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 10, 15000);
        $table = $this->createTable();
        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>2]]
        ]);
        $res->assertStatus(201);
        $this->assertDatabaseHas('orders', ['customer_name'=>'Budi']);
        $this->assertEquals(8, $prod->fresh()->stock);
        $order = Order::first();
        $this->assertNotNull($order->tracking_token);
        $this->assertNotNull($order->order_number);
    }

    public function test_checkout_insufficient_stock()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 1);
        $table = $this->createTable();
        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>5]]
        ]);
        $res->assertStatus(422);
        $this->assertEquals(1, $prod->fresh()->stock);
    }

    public function test_checkout_append_and_billing()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 10, 10000);
        $table = $this->createTable();
        // set billing
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        \App\Models\Setting::set('service_charge_percent','10');
        \App\Models\Setting::set('tax_percent','11');
        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]]
        ]);
        $res->assertStatus(201);
        $order = Order::first();
        $this->assertEquals(10000, (float)$order->subtotal);
        $this->assertEquals(1000, (float)$order->service_charge);
        $this->assertEquals(1100, (float)$order->tax);
        // append
        $res2 = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'tracking_token'=>$order->tracking_token,
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]]
        ]);
        $res2->assertStatus(200);
        $this->assertEquals(8, $prod->fresh()->stock);
        $order->refresh();
        $this->assertEquals(20000, (float)$order->subtotal);
    }

    public function test_order_status_transition_and_cancel_stock_restore()
    {
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 10);
        $table = $this->createTable();
        $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>2]]
        ]);
        $order = Order::first();
        $this->assertEquals(8, $prod->fresh()->stock);
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        // alur KDS: pending -> confirmed -> preparing
        $this->patchJson("/api/orders/{$order->id}/status", ['status'=>'confirmed'], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        // invalid transition confirmed -> pending should fail
        $this->patchJson("/api/orders/{$order->id}/status", ['status'=>'pending'], ['Authorization'=>"Bearer $token"])->assertStatus(422);
        $this->patchJson("/api/orders/{$order->id}/status", ['status'=>'preparing'], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        // cancel should restore stock
        $this->patchJson("/api/orders/{$order->id}/status", ['status'=>'cancelled'], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->assertEquals(10, $prod->fresh()->stock);
        // duplicate cancel should fail
        $this->patchJson("/api/orders/{$order->id}/status", ['status'=>'cancelled'], ['Authorization'=>"Bearer $token"])->assertStatus(422);
    }

    public function test_realtime_auth_required()
    {
        $this->getJson('/api/realtime/events')->assertStatus(401);
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        // we don't actually open SSE, just check endpoint exists and requires auth
        // order track SSE requires order exists
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 10);
        $table = $this->createTable();
        $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]]
        ]);
        $order = Order::first();
        $this->getJson("/api/orders/track/{$order->tracking_token}/events")->assertStatus(200);
        $this->getJson("/api/orders/track/invalidtoken1234567890abcdef1234567890abcdef1234567890ab/events")->assertStatus(404);
    }

    public function test_reports_day_week_month()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        // empty reports should work
        $this->getJson('/api/reports/sales?period=day&date=2026-09-20', ['Authorization'=>"Bearer $token"])->assertStatus(200)->assertJsonStructure(['data'=>['summary','comparison','top_products']]);
        $this->getJson('/api/reports/sales?period=week&date=2026-09-20', ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->getJson('/api/reports/sales?period=month&date=2026-09-20', ['Authorization'=>"Bearer $token"])->assertStatus(200);
        // with data
        $cat = $this->createCategory();
        $prod = $this->createProduct($cat, 10, 10000);
        $table = $this->createTable();
        $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]]
        ]);
        // make it paid
        $order = Order::first();
        $cashier = $this->cashier();
        Sanctum::actingAs($cashier, ['*']);
        $this->patchJson("/api/orders/{$order->id}/payment", [])->assertStatus(200);
        Sanctum::actingAs($this->admin(), ['*']);
        $res = $this->getJson('/api/reports/sales?period=day&date='.now()->format('Y-m-d'));
        $res->assertStatus(200);
        $this->assertGreaterThan(0, $res->json('data.summary.total_transactions'));
    }

    public function test_audit_and_stock_history_pagination()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $this->getJson('/api/audit-logs?per_page=15', ['Authorization'=>"Bearer $token"])->assertStatus(200)->assertJsonStructure(['data','meta']);
        $this->getJson('/api/stock-mutations?per_page=15', ['Authorization'=>"Bearer $token"])->assertStatus(200)->assertJsonStructure(['data','meta']);
    }
}
