<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
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
            'required' => 'nullable|boolean',
            'min_selections' => 'nullable|integer|min:0|max:99',
            'max_selections' => 'nullable|integer|min:0|max:99',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if (!isset($data['required'])) {
            $data['required'] = false;
        }
        if (!isset($data['min_selections'])) {
            $data['min_selections'] = $data['selection_type'] === 'single' ? 1 : 0;
        }
        if (!isset($data['max_selections'])) {
            $data['max_selections'] = $data['selection_type'] === 'single' ? 1 : null;
        }
        if (!isset($data['sort_order'])) {
            $data['sort_order'] = $product->optionGroups()->max('sort_order') + 1 ?? 0;
        }

        // Konsistensi: grup wajib minimal harus memilih 1 opsi.
        if (($data['required'] ?? false) && (int) ($data['min_selections'] ?? 1) < 1) {
            return response()->json([
                'message' => 'Grup opsi wajib harus memiliki minimal 1 pilihan.',
                'errors' => ['min_selections' => ['Grup opsi wajib harus memiliki minimal 1 pilihan.']],
            ], 422);
        }

        $group = $product->optionGroups()->create($data);
        $group->load('options');

        return response()->json([
            'message' => 'Product option group created successfully',
            'data' => $group,
        ], 201);
    }

    /**
     * Update grup opsi.
     */
    public function update(Request $request, Product $product, ProductOptionGroup $group)
    {
        if ($group->product_id !== $product->id) {
            return response()->json(['message' => 'Grup opsi tidak milik produk ini.'], 403);
        }

        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'selection_type' => ['sometimes', Rule::in(['single', 'multiple'])],
            'required' => 'sometimes|boolean',
            'min_selections' => 'sometimes|integer|min:0|max:99',
            'max_selections' => 'sometimes|integer|min:0|max:99|nullable',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        // Konsistensi: grup wajib minimal harus memilih 1 opsi.
        if (($data['required'] ?? $group->required) && (int) ($data['min_selections'] ?? $group->min_selections ?? 1) < 1) {
            return response()->json([
                'message' => 'Grup opsi wajib harus memiliki minimal 1 pilihan.',
                'errors' => ['min_selections' => ['Grup opsi wajib harus memiliki minimal 1 pilihan.']],
            ], 422);
        }

        // min_selections tidak boleh melebihi max_selections
        $min = (int) ($data['min_selections'] ?? $group->min_selections ?? 0);
        $max = array_key_exists('max_selections', $data)
            ? ($data['max_selections'] === null ? PHP_INT_MAX : (int) $data['max_selections'])
            : ($group->max_selections ?? null);
        if ($max !== null && $min > $max) {
            return response()->json([
                'message' => 'Minimal pilihan tidak boleh melebihi maksimal pilihan.',
                'errors' => ['min_selections' => ['Minimal pilihan tidak boleh melebihi maksimal pilihan.']],
            ], 422);
        }

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

        if ($this->groupInUse($group->id)) {
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

        $options = $group->options()->orderBy('sort_order')->orderBy('label')->get();

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
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if (!isset($data['sort_order'])) {
            $data['sort_order'] = $group->options()->max('sort_order') + 1 ?? 0;
        }

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
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        $option->update($data);

        return response()->json([
            'message' => 'Product option updated successfully',
            'data' => $option,
        ]);
    }

    /**
     * Cek apakah satu opsi/group dipakai di order items (cek JSON secara in-app,
     * tidak rely pada JSON_CONTAINS agar tidak terpengaruh tipe integer/float).
     */
    private function optionInUse(int $optionId): bool
    {
        return OrderItem::query()
            ->get()
            ->contains(function (OrderItem $item) use ($optionId) {
                $opts = $item->selected_options;
                if (!is_array($opts)) return false;
                foreach ($opts as $opt) {
                    if (isset($opt['option_id']) && (int) $opt['option_id'] === $optionId) {
                        return true;
                    }
                }
                return false;
            });
    }

    /**
     * Cek apakah satu grup dipakai di order items.
     */
    private function groupInUse(int $groupId): bool
    {
        return OrderItem::query()
            ->get()
            ->contains(function (OrderItem $item) use ($groupId) {
                $opts = $item->selected_options;
                if (!is_array($opts)) return false;
                foreach ($opts as $opt) {
                    if (isset($opt['option_group_id']) && (int) $opt['option_group_id'] === $groupId) {
                        return true;
                    }
                }
                return false;
            });
    }

    /**
     * Hapus opsi. Tidak boleh jika dipakai di order item.
     */
    public function destroyOption(Product $product, ProductOptionGroup $group, ProductOption $option)
    {
        if ($group->product_id !== $product->id || $option->option_group_id !== $group->id) {
            return response()->json(['message' => 'Opsi tidak dimiliki oleh produk/grup ini.'], 403);
        }

        if ($this->optionInUse($option->id)) {
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
