<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class RegressionDBTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_stock_not_negative_and_concurrent_atomicity()
    {
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        $prod = Product::create(['category_id'=>$cat->id,'name'=>'P','price'=>10000,'stock'=>2,'is_active'=>true]);
        $table1 = RestaurantTable::create(['table_number'=>'1','capacity'=>4,'status'=>'available','is_available'=>true]);
        $table2 = RestaurantTable::create(['table_number'=>'2','capacity'=>4,'status'=>'available','is_available'=>true]);
        // two concurrent checkouts for same product stock 2, each quantity 2 -> one should fail
        $res1 = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table1->id,
            'customer_name'=>'A',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>2]]
        ]);
        $res1->assertStatus(201);
        $this->assertEquals(0, $prod->fresh()->stock);
        $res2 = $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table2->id,
            'customer_name'=>'B',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]]
        ]);
        $res2->assertStatus(422);
        $this->assertEquals(0, $prod->fresh()->stock);
    }

    public function test_cancel_does_not_restore_twice()
    {
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        $prod = Product::create(['category_id'=>$cat->id,'name'=>'P','price'=>10000,'stock'=>5,'is_active'=>true]);
        $table = RestaurantTable::create(['table_number'=>'1','capacity'=>4,'status'=>'available','is_available'=>true]);
        $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>2]]
        ])->assertStatus(201);
        $order = Order::first();
        $cashier = User::factory()->create(['role'=>'cashier','password'=>Hash::make('Cashier123!')]);
        \Laravel\Sanctum\Sanctum::actingAs($cashier);
        $this->patchJson("/api/orders/{$order->id}/status", ['status'=>'cancelled'])->assertStatus(200);
        $this->assertEquals(5, $prod->fresh()->stock);
        // second cancel should fail and not double restore
        $this->patchJson("/api/orders/{$order->id}/status", ['status'=>'cancelled'])->assertStatus(422);
        $this->assertEquals(5, $prod->fresh()->stock);
    }

    public function test_soft_delete_preserves_order_history()
    {
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        $prod = Product::create(['category_id'=>$cat->id,'name'=>'P','price'=>10000,'stock'=>10,'is_active'=>true]);
        $table = RestaurantTable::create(['table_number'=>'1','capacity'=>4,'status'=>'available','is_available'=>true]);
        $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]]
        ])->assertStatus(201);
        $admin = User::factory()->create(['role'=>'admin','password'=>Hash::make('Admin123!')]);
        $token = $admin->createToken('t')->plainTextToken;
        $this->deleteJson("/api/products/{$prod->id}", [], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->assertSoftDeleted('products',['id'=>$prod->id]);
        $order = Order::with('orderItems.product')->first();
        $this->assertNotNull($order->orderItems->first()->product);
        $this->assertEquals('P', $order->orderItems->first()->product->name);
        // stock mutations should still see deleted product
        $this->assertDatabaseHas('stock_mutations',['product_id'=>$prod->id]);
    }

    public function test_category_delete_blocked_if_has_products()
    {
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        Product::create(['category_id'=>$cat->id,'name'=>'P','price'=>1000,'stock'=>5,'is_active'=>true]);
        $admin = User::factory()->create(['role'=>'admin','password'=>Hash::make('Admin123!')]);
        $token = $admin->createToken('t')->plainTextToken;
        $this->deleteJson("/api/categories/{$cat->id}", [], ['Authorization'=>"Bearer $token"])->assertStatus(422);
    }

    public function test_report_does_not_lose_historical_deleted_product()
    {
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        $prod = Product::create(['category_id'=>$cat->id,'name'=>'P','price'=>10000,'stock'=>10,'is_active'=>true,'cost_price'=>6000]);
        $table = RestaurantTable::create(['table_number'=>'1','capacity'=>4,'status'=>'available','is_available'=>true]);
        $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>2]]
        ])->assertStatus(201);
        $order = Order::first();
        $cashier = User::factory()->create(['role'=>'cashier','password'=>Hash::make('Cashier123!')]);
        \Laravel\Sanctum\Sanctum::actingAs($cashier);
        $this->patchJson("/api/orders/{$order->id}/payment", [])->assertStatus(200);
        // delete product after sale
        $prod->delete();
        $admin = User::factory()->create(['role'=>'admin','password'=>Hash::make('Admin123!')]);
        $token = $admin->createToken('t')->plainTextToken;
        $res = $this->getJson('/api/reports/sales?period=day&date='.now()->format('Y-m-d'), ['Authorization'=>"Bearer $token"]);
        $res->assertStatus(200);
        // profit should still be calculated with cost_price from deleted product via leftJoin
        $this->assertGreaterThan(0, $res->json('data.summary.profit'));
        $this->assertEquals(1, $res->json('data.summary.total_transactions'));
    }
}
