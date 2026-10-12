<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Requests\Product\IndexProductRequest;
use App\Services\AuditLogger;
use App\Services\Realtime;
use App\Services\StockMutationService;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexProductRequest $request)
{
    $page = $request->integer('page', 1);
    $perPage = $request->integer('per_page', 15);
    // batasi max agar tidak OOM
    $perPage = max(1, min($perPage, 50));

    $products = Product::with('category')
        ->when($request->filled('search'), function ($query) use ($request) {
            $query->where('name', 'like', '%' . trim($request->input('search')) . '%');
        })
        ->when($request->filled('category_id'), function ($query) use ($request) {
            $query->where('category_id', $request->input('category_id'));
        })
        ->latest()
        ->paginate($perPage, ['*'], 'page', $page);

    return response()->json([
        'message' => 'Products retrieved successfully',
        'data' => $products->items(),
        'meta' => [
            'current_page' => $products->currentPage(),
            'last_page' => $products->lastPage(),
            'per_page' => $products->perPage(),
            'total' => $products->total(),
            'has_more' => $products->hasMorePages(),
        ],
    ]);
}
    /**
     * Store a newly created resource in storage.
     */


public function store(StoreProductRequest $request)
{
    $data = $request->validated();

    if ($request->hasFile('image')) {
        $data['image'] = $request->file('image')->store('products', 'public');
    }

    $product = Product::create($data);

    StockMutationService::recordSet($product, (int) $product->stock, 'create');

    Realtime::push('products', ['type' => 'product.changed']);
    AuditLogger::record(
        'created',
        'product',
        $product->id,
        'Produk ' . $product->name . ' dibuat',
        null,
        ['name' => $product->name, 'price' => $product->price, 'stock' => (int) $product->stock]
    );

    return response()->json([
        'message' => 'Product created successfully',
        'data' => $product,
    ], 201);
}

    /**
     * Display the specified resource.
     */
    public function show(Product $product)
{
    $product->load('category');

    return response()->json([
        'message' => 'Product retrieved successfully',
        'data' => $product,
    ]);
}

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateProductRequest $request, Product $product)
{
    $old = $product->only(['name', 'price', 'cost_price', 'stock', 'is_active', 'category_id']);

    $data = $request->validated();

    if ($request->hasFile('image')) {
        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }
        $data['image'] = $request->file('image')->store('products', 'public');
    }

    $product->update($data);

    if ((int) $product->stock !== (int) $old['stock']) {
        StockMutationService::recordSet($product, (int) $product->stock, 'update');
    }

    Realtime::push('products', ['type' => 'product.changed']);
    AuditLogger::record(
        'updated',
        'product',
        $product->id,
        'Produk ' . $product->name . ' diperbarui',
        $old,
        ['name' => $product->name, 'price' => $product->price, 'cost_price' => $product->cost_price, 'stock' => (int) $product->stock, 'is_active' => $product->is_active, 'category_id' => $product->category_id]
    );

    return response()->json([
        'message' => 'Product updated successfully',
        'data' => $product,
    ]);
}

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Product $product)
{
    $name = $product->name;

    $product->delete();

    Realtime::push('products', ['type' => 'product.changed']);
    AuditLogger::record(
        'deleted',
        'product',
        $product->id,
        'Produk ' . $name . ' dihapus'
    );

    return response()->json([
        'message' => 'Product deleted successfully',
    ]);
}
}
