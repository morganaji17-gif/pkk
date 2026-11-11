<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductOptionGroup;
use App\Models\ProductOption;
use App\Services\Realtime;
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
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'message' => 'Product option groups retrieved successfully',
            'data' => $groups,
        ]);
    }

    /**
     * Detail satu grup opsi beserta opsinya (admin).
     */
    public function show(Product $product, ProductOptionGroup $group)
    {
        if ($group->product_id !== $product->id) {
            return response()->json(['message' => 'Grup opsi tidak milik produk ini.'], 403);
        }

        $group->load('options');

        return response()->json([
            'message' => 'Product option group retrieved successfully',
            'data' => $group,
        ]);
    }

    /**
     * Buat grup opsi baru untuk produk.
     */
    public function store(Request $request, Product $product)
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('product_option_groups', 'name')
                    ->where(fn ($query) => $query->where('product_id', $product->id)),
            ],
            'selection_type' => ['required', Rule::in(['single', 'multiple'])],
            'required' => 'nullable|boolean',
            'min_selections' => 'nullable|integer|min:0|max:99',
            'max_selections' => 'nullable|integer|min:0|max:99',
            'sort_order' => 'nullable|integer|min:0',
        ], [
            'name.unique' => 'Nama grup opsi sudah dipakai produk ini.',
        ]);

        $required = (bool) ($data['required'] ?? false);
        $selectionType = $data['selection_type'];

        if ($selectionType === 'single') {
            $min = $required ? 1 : 0;
            $max = 1;
        } else {
            $min = (int) ($data['min_selections'] ?? 0);
            if ($required) {
                $min = max(1, $min);
            }
            $max = array_key_exists('max_selections', $data) && $data['max_selections'] !== null
                ? (int) $data['max_selections']
                : null;
        }

        if ($max !== null && $min > $max) {
            return response()->json([
                'message' => 'Minimal pilihan tidak boleh melebihi maksimal pilihan.',
                'errors' => ['min_selections' => ['Minimal pilihan tidak boleh melebihi maksimal pilihan.']],
            ], 422);
        }

        $data['required'] = $required;
        $data['min_selections'] = $min;
        $data['max_selections'] = $max;
        $data['sort_order'] = $data['sort_order']
            ?? (((int) $product->optionGroups()->max('sort_order')) + 1);

        $group = $product->optionGroups()->create($data);
        $group->load('options');

        $this->announce($product);

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
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('product_option_groups', 'name')
                    ->where(fn ($query) => $query->where('product_id', $product->id))
                    ->ignore($group->id),
            ],
            'selection_type' => ['sometimes', Rule::in(['single', 'multiple'])],
            'required' => 'sometimes|boolean',
            'min_selections' => 'sometimes|integer|min:0|max:99',
            'max_selections' => 'sometimes|integer|min:0|max:99|nullable',
            'sort_order' => 'sometimes|integer|min:0',
        ], [
            'name.unique' => 'Nama grup opsi sudah dipakai produk ini.',
        ]);

        $selectionType = $data['selection_type'] ?? $group->selection_type;
        $required = array_key_exists('required', $data)
            ? (bool) $data['required']
            : (bool) $group->required;

        $min = array_key_exists('min_selections', $data)
            ? (int) $data['min_selections']
            : (int) ($group->min_selections ?? 0);

        $max = array_key_exists('max_selections', $data)
            ? ($data['max_selections'] === null ? null : (int) $data['max_selections'])
            : ($group->max_selections === null ? null : (int) $group->max_selections);

        if ($selectionType === 'single') {
            $min = $required ? 1 : 0;
            $max = 1;
        } else {
            $min = max(0, $min);
            if ($required) {
                $min = max(1, $min);
            }
        }

        if ($max !== null && $min > $max) {
            return response()->json([
                'message' => 'Minimal pilihan tidak boleh melebihi maksimal pilihan.',
                'errors' => ['min_selections' => ['Minimal pilihan tidak boleh melebihi maksimal pilihan.']],
            ], 422);
        }

        // Grup wajib tanpa opsi membuat produk tidak bisa dipesan.
        if ($required && $group->options()->count() === 0) {
            return response()->json([
                'message' => 'Grup wajib harus memiliki minimal satu opsi. Tambahkan opsi terlebih dahulu.',
                'errors' => ['required' => ['Grup wajib harus memiliki minimal satu opsi.']],
            ], 422);
        }

        $data['required'] = $required;
        $data['selection_type'] = $selectionType;
        $data['min_selections'] = $min;
        $data['max_selections'] = $max;

        $group->update($data);
        $group->load('options');

        $this->announce($product);

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

        $this->announce($product);

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

        $this->announce($product);

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

        $this->announce($product);

        return response()->json([
            'message' => 'Product option updated successfully',
            'data' => $option,
        ]);
    }

    /**
     * Cek apakah satu opsi/group dipakai di order items.
     * Query langsung di DB via JSON_CONTAINS (kolom selected_options bertipe JSON),
     * bukan load semua order item ke memory.
     * CATATAN: pengujian manual menunjukkan MySQL JSON_CONTAINS cocok hanya
     * untuk tipe sama (int vs string). Data snapshot dari CheckoutService
     * selalu menulis integer, jadi aman.
     * CATATAN-2: SQLite tidak punya JSON_CONTAINS — fallback ke in-memory
     * untuk lingkungan test.
     */
    private function optionInUse(int $optionId): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return OrderItem::query()
                ->get()
                ->contains(fn (OrderItem $item) => $this->optionMatchesId($item, $optionId));
        }

        return OrderItem::query()
            ->whereRaw('JSON_CONTAINS(selected_options, ?)', ['{"option_id": ' . $optionId . '}'])
            ->exists();
    }

    /**
     * Cek apakah satu grup dipakai di order items.
     */
    private function groupInUse(int $groupId): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return OrderItem::query()
                ->get()
                ->contains(fn (OrderItem $item) => $this->groupMatchesId($item, $groupId));
        }

        return OrderItem::query()
            ->whereRaw('JSON_CONTAINS(selected_options, ?)', ['{"option_group_id": ' . $groupId . '}'])
            ->exists();
    }

    private function optionMatchesId(OrderItem $item, int $optionId): bool
    {
        $opts = $item->selected_options;
        if (!is_array($opts)) return false;
        foreach ($opts as $opt) {
            if (isset($opt['option_id']) && (int) $opt['option_id'] === $optionId) {
                return true;
            }
        }
        return false;
    }

    private function groupMatchesId(OrderItem $item, int $groupId): bool
    {
        $opts = $item->selected_options;
        if (!is_array($opts)) return false;
        foreach ($opts as $opt) {
            if (isset($opt['option_group_id']) && (int) $opt['option_group_id'] === $groupId) {
                return true;
            }
        }
        return false;
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

        $this->announce($product);

        return response()->json([
            'message' => 'Product option deleted successfully',
        ]);
    }

    /**
     * Beri tahu client lain (kasir, customer, KDS) bahwa opsi produk berubah.
     */
    private function announce(Product $product): void
    {
        Realtime::push('products', [
            'type' => 'product.options.changed',
            'product_id' => $product->id,
        ]);
    }
}
