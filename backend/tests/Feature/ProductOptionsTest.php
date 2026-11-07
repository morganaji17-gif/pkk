<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionGroup;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProductOptionsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'password' => Hash::make('Admin123!')]);
    }

    private function customer()
    {
        return User::factory()->create(['role' => 'customer', 'password' => Hash::make('Customer123!')]);
    }

    private function createProductWithCategories(): array
    {
        $cat = Category::create(['name' => 'Test', 'is_active' => true]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Produk Tes',
            'price' => 15000,
            'cost_price' => 8000,
            'stock' => 10,
            'is_active' => true,
        ]);

        return ['product' => $prod, 'table' => $table, 'category' => $cat];
    }

    public function test_admin_can_create_option_group()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $product = Product::create([
            'category_id' => Category::create(['name' => 'Cat'])->id,
            'name' => 'Produk',
            'price' => 10000,
            'stock' => 5,
            'is_active' => true,
        ]);

        $res = $this->postJson("/api/products/{$product->id}/options", [
            'name' => 'Level Pedas',
            'selection_type' => 'single',
            'required' => true,
            'min_selections' => 1,
            'max_selections' => 1,
        ], ['Authorization' => "Bearer $token"])->assertStatus(201);

        $this->assertDatabaseHas('product_option_groups', [
            'id' => $res->json('data.id'),
            'name' => 'Level Pedas',
            'required' => true,
        ]);
    }

    public function test_admin_can_add_option_to_group()
    {
        $admin = $this->admin();
        $token = $admin->createToken('t')->plainTextToken;
        $product = Product::create([
            'category_id' => Category::create(['name' => 'Cat'])->id,
            'name' => 'Produk',
            'price' => 10000,
            'stock' => 5,
            'is_active' => true,
        ]);
        $group = $product->optionGroups()->create(['name' => 'Level', 'selection_type' => 'single', 'required' => true]);

        $res = $this->postJson("/api/products/{$product->id}/options/{$group->id}/options", [
            'label' => 'Pedas',
            'additional_price' => 0,
        ], ['Authorization' => "Bearer $token"])->assertStatus(201);

        $this->assertDatabaseHas('product_options', [
            'id' => $res->json('data.id'),
            'option_group_id' => $group->id,
            'label' => 'Pedas',
        ]);
    }

    public function test_product_without_options_can_be_ordered()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Nasi',
            'price' => 10000,
            'stock' => 5,
            'is_active' => true,
        ]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [['product_id' => $prod->id, 'quantity' => 1]],
        ], ['Authorization' => "Bearer $token"])->assertStatus(201);

        $this->assertDatabaseHas('order_items', [
            'product_id' => $prod->id,
            'quantity' => 1,
        ]);
    }

    public function test_checkout_validates_required_option()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Ayam Geprek',
            'price' => 15000,
            'stock' => 5,
            'is_active' => true,
        ]);
        $group = $prod->optionGroups()->create([
            'name' => 'Level Pedas',
            'selection_type' => 'single',
            'required' => true,
            'min_selections' => 1,
            'max_selections' => 1,
        ]);
        $option = $group->options()->create(['label' => 'Pedas', 'additional_price' => 0]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        // Tanpa memilih opsi wajib
        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [['product_id' => $prod->id, 'quantity' => 1]],
        ], ['Authorization' => "Bearer $token"])
            ->assertStatus(422)
            ->assertJsonFragment(['message' => "Pilih minimal 1 opsi untuk 'Level Pedas'."]);
    }

    public function test_checkout_accepts_valid_option_selection()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Ayam Geprek',
            'price' => 15000,
            'stock' => 5,
            'is_active' => true,
        ]);
        $group = $prod->optionGroups()->create([
            'name' => 'Level Pedas',
            'selection_type' => 'single',
            'required' => true,
            'min_selections' => 1,
            'max_selections' => 1,
        ]);
        $option = $group->options()->create(['label' => 'Pedas', 'additional_price' => 0]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [[
                'product_id' => $prod->id,
                'quantity' => 1,
                'selected_options' => [['option_group_id' => $group->id, 'option_id' => $option->id]],
            ]],
        ], ['Authorization' => "Bearer $token"])
            ->assertStatus(201);

        $item = $res->json('data.order_items')[0];
        $this->assertEquals($prod->price, $item['price']);
        $this->assertNotNull($item['selected_options']);
        $this->assertEquals($group->id, $item['selected_options'][0]['option_group_id']);
        $this->assertEquals($option->id, $item['selected_options'][0]['option_id']);
    }

    public function test_checkout_adds_option_price_to_total()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Es Teh',
            'price' => 5000,
            'stock' => 10,
            'is_active' => true,
        ]);
        $group = $prod->optionGroups()->create([
            'name' => 'Ukuran',
            'selection_type' => 'single',
            'required' => true,
            'min_selections' => 1,
            'max_selections' => 1,
        ]);
        $option = $group->options()->create(['label' => 'Large', 'additional_price' => 2000]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [[
                'product_id' => $prod->id,
                'quantity' => 1,
                'selected_options' => [['option_group_id' => $group->id, 'option_id' => $option->id]],
            ]],
        ], ['Authorization' => "Bearer $token"])
            ->assertStatus(201);

        $item = $res->json('data.order_items')[0];
        $this->assertEquals(7000, $item['price']);
    }

    public function test_rejects_option_from_different_product()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod1 = Product::create([
            'category_id' => $cat->id,
            'name' => 'Produk 1',
            'price' => 10000,
            'stock' => 5,
            'is_active' => true,
        ]);
        $prod2 = Product::create([
            'category_id' => $cat->id,
            'name' => 'Produk 2',
            'price' => 10000,
            'stock' => 5,
            'is_active' => true,
        ]);
        $group2 = $prod2->optionGroups()->create(['name' => 'Level', 'selection_type' => 'single', 'required' => true]);
        $option2 = $group2->options()->create(['label' => 'Pedas', 'additional_price' => 0]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [[
                'product_id' => $prod1->id,
                'quantity' => 1,
                'selected_options' => [['option_group_id' => $group2->id, 'option_id' => $option2->id]],
            ]],
        ], ['Authorization' => "Bearer $token"])
            ->assertStatus(422);
    }

    public function test_customer_cannot_access_admin_options()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $product = Product::create([
            'category_id' => Category::create(['name' => 'Cat'])->id,
            'name' => 'Produk',
            'price' => 10000,
            'stock' => 5,
            'is_active' => true,
        ]);

        $this->postJson("/api/products/{$product->id}/options", [
            'name' => 'Level',
            'selection_type' => 'single',
        ], ['Authorization' => "Bearer $token"])
            ->assertStatus(403);
    }

    public function test_multiple_choice_respects_min_max()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Burger',
            'price' => 20000,
            'stock' => 5,
            'is_active' => true,
        ]);
        $group = $prod->optionGroups()->create([
            'name' => 'Topping',
            'selection_type' => 'multiple',
            'required' => true,
            'min_selections' => 1,
            'max_selections' => 2,
        ]);
        $opt1 = $group->options()->create(['label' => 'Keju', 'additional_price' => 3000]);
        $opt2 = $group->options()->create(['label' => 'Telur', 'additional_price' => 2000]);
        $opt3 = $group->options()->create(['label' => 'Sosis', 'additional_price' => 3000]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        // Terlalu banyak pilihan
        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [[
                'product_id' => $prod->id,
                'quantity' => 1,
                'selected_options' => [
                    ['option_group_id' => $group->id, 'option_id' => $opt1->id],
                    ['option_group_id' => $group->id, 'option_id' => $opt2->id],
                    ['option_group_id' => $group->id, 'option_id' => $opt3->id],
                ],
            ]],
        ], ['Authorization' => "Bearer $token"])
            ->assertStatus(422);
    }

    /** REGRESSION: Opsi tidak hilang saat checkout → order item snapshot lengkap */
    public function test_option_snapshot_preserves_all_fields_in_order_item()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Burger',
            'price' => 25000,
            'stock' => 10,
            'is_active' => true,
        ]);
        $group = $prod->optionGroups()->create([
            'name' => 'Tingkat',
            'selection_type' => 'single',
            'required' => true,
            'min_selections' => 1,
            'max_selections' => 1,
        ]);
        $opt = $group->options()->create(['label' => 'Level 5', 'additional_price' => 5000]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [[
                'product_id' => $prod->id,
                'quantity' => 2,
                'selected_options' => [['option_group_id' => $group->id, 'option_id' => $opt->id]],
            ]],
        ], ['Authorization' => "Bearer $token"])->assertStatus(201);

        $item = $res->json('data.order_items.0');

        // Snapshot field harus ada, tidak null, dan berisi array
        $this->assertNotNull($item['selected_options']);
        $snapshot = $item['selected_options'];
        $this->assertIsArray($snapshot);
        $this->assertNotEmpty($snapshot);

        // Semua field snapshot harus ada
        $first = $snapshot[0];
        $this->assertArrayHasKey('option_group_id', $first);
        $this->assertArrayHasKey('option_group_label', $first);
        $this->assertArrayHasKey('option_id', $first);
        $this->assertArrayHasKey('option_label', $first);
        $this->assertArrayHasKey('additional_price', $first);

        // Nilai snapshot harus sinkron dengan data di DB
        $this->assertEquals($group->id, $first['option_group_id']);
        $this->assertEquals($group->name, $first['option_group_label']);
        $this->assertEquals($opt->id, $first['option_id']);
        $this->assertEquals($opt->label, $first['option_label']);
        $this->assertEquals(5000.0, $first['additional_price']);

        // Harga item = harga produk + tambahan opsi × quantity
        $this->assertEquals(30000, $item['price']); // 25000 + 5000
    }

    /** REGRESSION: Produk dengan opsi opsional (tidak wajib) bisa di-checkout tanpa pilih */
    public function test_optional_group_allows_checkout_without_selection()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Nasi',
            'price' => 10000,
            'stock' => 10,
            'is_active' => true,
        ]);
        $group = $prod->optionGroups()->create([
            'name' => 'Topping',
            'selection_type' => 'single',
            'required' => false, // opsional
            'min_selections' => 0,
        ]);
        $group->options()->create(['label' => 'Keju', 'additional_price' => 2000]);
        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        // Tanpa selected_options sama sekali → harus berhasil
        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [['product_id' => $prod->id, 'quantity' => 1]],
        ], ['Authorization' => "Bearer $token"])
            ->assertStatus(201)
            ->assertJsonPath('data.order_items.0.selected_options', null);
    }

    /** REGRESSION: Multiple products dalam satu checkout masing-masing punya required group */
    public function test_checkout_multiple_products_with_separate_required_options()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prodA = Product::create(['category_id' => $cat->id, 'name' => 'Mie', 'price' => 15000, 'stock' => 10, 'is_active' => true]);
        $prodB = Product::create(['category_id' => $cat->id, 'name' => 'Es', 'price' => 5000, 'stock' => 10, 'is_active' => true]);

        $groupA = $prodA->optionGroups()->create(['name' => 'Level Pedas', 'selection_type' => 'single', 'required' => true, 'min_selections' => 1, 'max_selections' => 1]);
        $optA = $groupA->options()->create(['label' => 'Pedas', 'additional_price' => 2000]);

        $groupB = $prodB->optionGroups()->create(['name' => 'Es', 'selection_type' => 'single', 'required' => true, 'min_selections' => 1, 'max_selections' => 1]);
        $optB = $groupB->options()->create(['label' => 'Ice', 'additional_price' => 0]);

        $table = RestaurantTable::create([
            'table_number' => '1',
            'capacity' => 4,
            'status' => 'available',
            'is_available' => true,
        ]);

        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $prodA->id, 'quantity' => 1, 'selected_options' => [['option_group_id' => $groupA->id, 'option_id' => $optA->id]]],
                ['product_id' => $prodB->id, 'quantity' => 1, 'selected_options' => [['option_group_id' => $groupB->id, 'option_id' => $optB->id]]],
            ],
        ], ['Authorization' => "Bearer $token"])->assertStatus(201);

        $this->assertCount(2, $res->json('data.order_items'));

        $itemA = collect($res->json('data.order_items'))->firstWhere('product_id', $prodA->id);
        $itemB = collect($res->json('data.order_items'))->firstWhere('product_id', $prodB->id);

        // Masing-masing item punya snapshot opsinya sendiri
        $this->assertEquals($optA->label, $itemA['selected_options'][0]['option_label']);
        $this->assertEquals($optB->label, $itemB['selected_options'][0]['option_label']);

        // Harga: (15000+2000)×1 + (5000+0)×1 = 22000
        $this->assertEquals(17000, $itemA['price']);
        $this->assertEquals(5000, $itemB['price']);
        $this->assertEquals(22000, $res->json('data.subtotal'));
    }

    /** REGRESSION: Admin update/delete option group — proteksi data lama di order item */
    public function test_option_group_delete_is_blocked_when_used_in_order()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $admin = $this->admin();
        $adminToken = $admin->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create(['category_id' => $cat->id, 'name' => 'Teh', 'price' => 5000, 'stock' => 10, 'is_active' => true]);
        $group = $prod->optionGroups()->create(['name' => 'Es', 'selection_type' => 'single', 'required' => false]);
        $opt = $group->options()->create(['label' => 'Ice', 'additional_price' => 0]);
        $table = RestaurantTable::create(['table_number' => '1', 'capacity' => 4, 'status' => 'available', 'is_available' => true]);

        // Buat order yang menggunakan opsi
        $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [['product_id' => $prod->id, 'quantity' => 1, 'selected_options' => [['option_group_id' => $group->id, 'option_id' => $opt->id]]]],
        ], ['Authorization' => "Bearer $token"])->assertStatus(201);

        // Opsi tidak bisa dihapus karena sudah ada di order item
        $this->deleteJson("/api/products/{$prod->id}/options/{$group->id}/options/{$opt->id}", [], ['Authorization' => "Bearer $adminToken"])
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Opsi tidak bisa dihapus karena sudah dipakai di pesanan.']);

        // Grup tidak bisa dihapus karena sudah ada di order item
        $this->deleteJson("/api/products/{$prod->id}/options/{$group->id}", [], ['Authorization' => "Bearer $adminToken"])
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Grup opsi tidak bisa dihapus karena sudah dipakai di pesanan.']);
    }

    /** REGRESSION: Opsi wajib tapi quantity > 1 tetap butuh pemilihan opsi (tidak double-validate) */
    public function test_required_option_with_quantity_greater_than_one_works()
    {
        $customer = $this->customer();
        $token = $customer->createToken('t')->plainTextToken;
        $cat = Category::create(['name' => 'Cat', 'is_active' => true]);
        $prod = Product::create(['category_id' => $cat->id, 'name' => 'Nasi', 'price' => 12000, 'stock' => 10, 'is_active' => true]);
        $group = $prod->optionGroups()->create(['name' => 'Pedas', 'selection_type' => 'single', 'required' => true, 'min_selections' => 1]);
        $opt = $group->options()->create(['label' => 'Level 3', 'additional_price' => 1000]);
        $table = RestaurantTable::create(['table_number' => '1', 'capacity' => 4, 'status' => 'available', 'is_available' => true]);

        // quantity 5, opsi dipilih 1× → harus berhasil
        $res = $this->postJson('/api/checkout', [
            'restaurant_table_id' => $table->id,
            'customer_name' => 'Test',
            'payment_method' => 'cash',
            'items' => [[
                'product_id' => $prod->id,
                'quantity' => 5,
                'selected_options' => [['option_group_id' => $group->id, 'option_id' => $opt->id]],
            ]],
        ], ['Authorization' => "Bearer $token"])->assertStatus(201);

        $item = $res->json('data.order_items.0');
        // unit price = 12000 + 1000 = 13000, subtotal = 13000 * 5 = 65000
        $this->assertEquals(13000, $item['price']);
        $this->assertEquals(65000, $item['subtotal']);
        $this->assertEquals(5, $item['quantity']);
    }
}
