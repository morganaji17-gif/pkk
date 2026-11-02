<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductOptionGroup;
use App\Models\ProductOption;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductOptionsController extends Controller
{
    // --- Option Groups ---

    /**
     * List semua grup opsi untuk produk tertentu (admin).
     */
    public function index(Request $request, Product $product)
    {
        $groups = $product
            ->optionGroups()
            ->with('options')
            ->orderBy('name')
            ->get();

        return response()->json([
            'message' => 'Product option groups retrieved successfully',
            'data' => $groups,
        ]);
    }

    /**
     * Buat grup opsi baru untuk produk.
     */
    public function store(Request $request, Product $product)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'selection_type' => ['required', Rule::in(['single', 'multiple'])],
        ]);

        $group = $product->optionGroups()->create($data);
        $group->load('options');

        return response()->json([
            'message' => 'Product option group created successfully',
            'data' => $group,
        ], 201);
    }

    /**
     * Update grup opsi (hanya nama & selection_type).
     */
    public function update(Request $request, Product $product, ProductOptionGroup $group)
    {
        if ($group->product_id !== $product->id) {
            return response()->json(['message' => 'Grup opsi tidak milik produk ini.'], 403);
        }

        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'selection_type' => ['sometimes', Rule::in(['single', 'multiple'])],
        ]);

        $group->update($data);
        $group->load('options');

        return response()->json([
            'message' => 'Product option group updated successfully',
            'data' => $group,
        ]);
    }

    /**
     * Hapus grup opsi beserta opsinya (cascade).
     * Tidak boleh dihapus jika ada order item yang pakai.
     */
    public function destroy(Product $product, ProductOptionGroup $group)
    {
        if ($group->product_id !== $product->id) {
            return response()->json(['message' => 'Grup opsi tidak milik produk ini.'], 403);
        }

        // Ambil count order items yang pakai grup ini (via JSON_contains)
        $inUse = \App\Models\OrderItem::query()
            ->whereJsonContains('selected_options', ['option_group_id' => $group->id])
            ->exists();

        if ($inUse) {
            return response()->json([
                'message' => 'Grup opsi tidak bisa dihapus karena sudah dipakai di pesanan.',
            ], 422);
        }

        // Hapus semua option dulu, baru grup
        $group->options()->delete();
        $group->delete();

        return response()->json([
            'message' => 'Product option group deleted successfully',
        ]);
    }

    // --- Options ---

    /**
     * List semua opsi di dalam grup.
     */
    public function listOptions(Request $request, Product $product, ProductOptionGroup $group)
    {
        if ($group->product_id !== $product->id) {
            return response()->json(['message' => 'Opsi tidak milik grup ini.'], 403);
        }

        $options = $group->options()->orderBy('additional_price')->orderBy('label')->get();

        return response()->json([
            'message' => 'Product options retrieved successfully',
            'data' => $options,
        ]);
    }

    /**
     * Tambah opsi baru ke grup.
     */
    public function addOption(Request $request, Product $product, ProductOptionGroup $group)
    {
        if ($group->product_id !== $product->id) {
            return response()->json(['message' => 'Opsi tidak milik grup ini.'], 403);
        }

        $data = $request->validate([
            'label' => 'required|string|max:100',
            'additional_price' => 'nullable|numeric|min:0',
        ]);

        $option = $group->options()->create($data);

        return response()->json([
            'message' => 'Product option created successfully',
            'data' => $option,
        ], 201);
    }

    /**
     * Update label / harga tambahan.
     */
    public function updateOption(Request $request, Product $product, ProductOptionGroup $group, ProductOption $option)
    {
        if ($group->product_id !== $product->id || $option->option_group_id !== $group->id) {
            return response()->json(['message' => 'Opsi tidak dimiliki oleh produk/grup ini.'], 403);
        }

        $data = $request->validate([
            'label' => 'sometimes|string|max:100',
            'additional_price' => 'sometimes|numeric|min:0',
        ]);

        $option->update($data);

        return response()->json([
            'message' => 'Product option updated successfully',
            'data' => $option,
        ]);
    }

    /**
     * Hapus opsi. Tidak boleh jika dipakai di order item.
     */
    public function destroyOption(Product $product, ProductOptionGroup $group, ProductOption $option)
    {
        if ($group->product_id !== $product->id || $option->option_group_id !== $group->id) {
            return response()->json(['message' => 'Opsi tidak dimiliki oleh produk/grup ini.'], 403);
        }

        $inUse = \App\Models\OrderItem::query()
            ->whereJsonContains('selected_options', ['option_id' => $option->id])
            ->exists();

        if ($inUse) {
            return response()->json([
                'message' => 'Opsi tidak bisa dihapus karena sudah dipakai di pesanan.',
            ], 422);
        }

        $option->delete();

        return response()->json([
            'message' => 'Product option deleted successfully',
        ]);
    }
}
