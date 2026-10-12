<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Http\Requests\Category\StoreCategoryRequest;
use App\Http\Requests\Category\UpdateCategoryRequest;
use App\Http\Requests\Category\IndexCategoryRequest;
use App\Services\AuditLogger;
use App\Services\Realtime;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;

class CategoryController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexCategoryRequest $request)
    {
        $page = $request->integer('page', 1);
        $perPage = $request->integer('per_page', 15);
        $perPage = max(1, min($perPage, 50));

        $categories = Category::query()
            ->when($request->filled('search'), function ($query) use ($request) {
                $query->where('name', 'like', '%' . trim($request->input('search')) . '%');
            })
            ->latest()
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'message' => 'Categories retrieved successfully',
            'data' => $categories->items(),
            'meta' => [
                'current_page' => $categories->currentPage(),
                'last_page' => $categories->lastPage(),
                'per_page' => $categories->perPage(),
                'total' => $categories->total(),
                'has_more' => $categories->hasMorePages(),
            ],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCategoryRequest $request )
    {
        $data = $request->validated();

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('categories', 'public');
        }
        
        $category = Category::create($data);

        Realtime::push('categories', ['type' => 'category.changed']);
        AuditLogger::record(
            'created',
            'category',
            $category->id,
            'Kategori ' . $category->name . ' dibuat'
        );

        return response()->json([
            'message' => 'Category created successfully',
            'data' => $category,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Category $category)
    {
        return response()->json([
            'message' => 'Category retrieved successfully',
            'data' => $category,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCategoryRequest $request, Category $category)
    {
        $data = $request->validated();

        if ($request->hasFile('image')) {
            if ($category->image) {
                Storage::disk('public')->delete($category->image);
            }
            $data['image'] = $request->file('image')->store('categories', 'public');
        }

        $category->update($data);

        Realtime::push('categories', ['type' => 'category.changed']);
        AuditLogger::record(
            'updated',
            'category',
            $category->id,
            'Kategori ' . $category->name . ' diperbarui'
        );

        return response()->json([
            'message' => 'Category updated successfully',
            'data' => $category,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Category $category)
    {
        $productCount = $category->products()->withTrashed()->count();

        if ($productCount > 0) {
            return response()->json([
                'message' => "Kategori masih dipakai oleh {$productCount} produk. Pindahkan atau hapus produk tersebut terlebih dahulu.",
            ], 422);
        }

        $name = $category->name;
        $image = $category->image;

        try {
            $category->delete();
        } catch (QueryException $e) {
            return response()->json([
                'message' => 'Kategori masih dipakai oleh produk. Pindahkan atau hapus produk tersebut terlebih dahulu.',
            ], 422);
        }

        if ($image) {
            Storage::disk('public')->delete($image);
        }

        Realtime::push('categories', ['type' => 'category.changed']);
        AuditLogger::record(
            'deleted',
            'category',
            $category->id,
            'Kategori ' . $name . ' dihapus'
        );

        return response()->json([
            'message' => 'Category deleted successfully',
        ]);
    }
}
