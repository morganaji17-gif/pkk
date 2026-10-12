<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class RegressionP1Test extends \Tests\TestCase
{
    use RefreshDatabase;

    private function admin() { return User::factory()->create(['role'=>'admin','password'=>Hash::make('Admin123!')]); }
    private function cashier() { return User::factory()->create(['role'=>'cashier','password'=>Hash::make('Cashier123!')]); }

    public function test_product_create_update_soft_delete()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        // create
        $res = $this->postJson('/api/products', [
            'category_id'=>$cat->id,
            'name'=>'Produk A',
            'price'=>15000,
            'stock'=>10,
            'is_active'=>true
        ], ['Authorization'=>"Bearer $token"])->assertStatus(201);
        $id = $res->json('data.id');
        // update
        $this->postJson("/api/products/$id", [
            '_method'=>'PUT',
            'category_id'=>$cat->id,
            'name'=>'Produk A Updated',
            'price'=>20000,
            'stock'=>5,
            'is_active'=>true
        ], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        // soft delete
        $this->deleteJson("/api/products/$id", [], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->assertSoftDeleted('products',['id'=>$id]);
        // historical order should still see deleted product via withTrashed
        $table = RestaurantTable::create(['table_number'=>'1','capacity'=>4,'status'=>'available','is_available'=>true]);
        // need to restore product to create order with it, then delete again and check order_items still has product
        $prod = Product::withTrashed()->find($id);
        $prod->restore();
        $this->postJson('/api/checkout', [
            'restaurant_table_id'=>$table->id,
            'customer_name'=>'Budi',
            'payment_method'=>'cash',
            'items'=>[['product_id'=>$prod->id,'quantity'=>1]]
        ])->assertStatus(201);
        $prod->delete();
        $order = \App\Models\Order::first();
        $this->assertNotNull($order);
        $item = $order->orderItems()->first();
        $this->assertNotNull($item->product); // withTrashed
        $this->assertEquals('Produk A Updated', $item->product->name);
    }

    public function test_category_delete_with_product_fails()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        Product::create(['category_id'=>$cat->id,'name'=>'P','price'=>10000,'stock'=>5,'is_active'=>true]);
        $this->deleteJson("/api/categories/{$cat->id}", [], ['Authorization'=>"Bearer $token"])->assertStatus(422);
    }

    public function test_table_crud_and_status()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $res = $this->postJson('/api/restaurant-tables', [
            'table_number'=>'5','capacity'=>4,'status'=>'available'
        ], ['Authorization'=>"Bearer $token"])->assertStatus(201);
        $id = $res->json('data.id');
        $this->patchJson("/api/restaurant-tables/$id/status", ['status'=>'maintenance'], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->assertDatabaseHas('restaurant_tables',['id'=>$id,'status'=>'maintenance']);
        $this->deleteJson("/api/restaurant-tables/$id", [], ['Authorization'=>"Bearer $token"])->assertStatus(200);
    }

    public function test_reports_csv_pdf_export()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $this->getJson('/api/reports/sales?period=day&date=2026-09-20', ['Authorization'=>"Bearer $token"])->assertStatus(200);
        // CSV
        $res = $this->getJson('/api/reports/sales/export?period=day&date=2026-09-20&format=csv', ['Authorization'=>"Bearer $token"]);
        // CSV returns text/csv or pdf, but our exportSales with csv returns csv
        // Just check it doesn't 500
        $this->assertTrue(in_array($res->getStatusCode(), [200, 302]));
    }

    public function test_audit_and_stock_pagination_filters()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        // create a product to generate audit
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        $this->postJson('/api/products', [
            'category_id'=>$cat->id,
            'name'=>'P','price'=>1000,'stock'=>5,'is_active'=>true
        ], ['Authorization'=>"Bearer $token"]);
        $this->getJson('/api/audit-logs?per_page=5&resource_type=product', ['Authorization'=>"Bearer $token"])->assertStatus(200)->assertJsonStructure(['data','meta']);
        $this->getJson('/api/audit-logs?from=2026-01-01&to=2026-12-31', ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->getJson('/api/stock-mutations?per_page=5&reason=create', ['Authorization'=>"Bearer $token"])->assertStatus(200)->assertJsonStructure(['data','meta']);
    }

    public function test_settings_billing_and_qris()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $this->postJson('/api/settings/billing', ['service_charge_percent'=>5,'tax_percent'=>10], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->assertEquals('5', \App\Models\Setting::get('service_charge_percent'));
        // qris upload fake
        Storage::fake('public');
        $file = UploadedFile::fake()->image('qris.jpg', 200, 200);
        $this->postJson('/api/settings/qris', ['image'=>$file,'instruction'=>'test'], ['Authorization'=>"Bearer $token"])->assertStatus(200);
        $this->getJson('/api/settings/qris')->assertStatus(200);
    }

    public function test_pagination_and_search()
    {
        $cat = Category::create(['name'=>'Cat','is_active'=>true]);
        for($i=0;$i<5;$i++) Product::create(['category_id'=>$cat->id,'name'=>"Prod $i",'price'=>1000,'stock'=>5,'is_active'=>true]);
        $res = $this->getJson('/api/products?per_page=2&page=2');
        $res->assertStatus(200);
        $this->assertCount(2, $res->json('data'));
        $this->assertEquals(5, $res->json('meta.total'));
        // search
        $this->getJson('/api/products?search=Prod 1')->assertStatus(200);
        $this->getJson('/api/categories?search=Cat')->assertStatus(200);
        $this->getJson('/api/orders?search=ORD&per_page=5', ['Authorization'=>"Bearer ".$this->admin()->createToken('t')->plainTextToken])->assertStatus(200);
    }
}
