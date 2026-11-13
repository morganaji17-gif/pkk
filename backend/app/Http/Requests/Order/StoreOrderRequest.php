<?php

namespace App\Http\Requests\Order;

use App\Models\RestaurantTable;
use App\Services\TableAccessService;
use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Terjemahkan token meja → restaurant_table_id sebelum validasi.
     *
     * Urutan prioritas:
     * 1. `checkout_token` (jangka pendek, dari QR/resolve)
     * 2. `table_token` (public_token permanen)
     * 3. `restaurant_table_id` (legacy, tetap didukung + dibatasi cap pesanan)
     */
    protected function prepareForValidation(): void
    {
        if ($this->filled('checkout_token')) {
            $table = app(TableAccessService::class)->resolveCheckoutToken((string) $this->input('checkout_token'));
            // Selalu timpa ID mentah: token yang tidak valid tidak boleh
            // "jatuh" ke restaurant_table_id kiriman client.
            $this->merge(['restaurant_table_id' => $table?->id]);
            return;
        }

        if ($this->filled('table_token')) {
            $table = RestaurantTable::where('public_token', (string) $this->input('table_token'))->first();
            $this->merge(['restaurant_table_id' => $table?->id]);
        }
    }

    public function rules(): array
    {
        return [
            'checkout_token' => [
                'nullable',
                'string',
            ],

            'table_token' => [
                'nullable',
                'string',
                'max:64',
            ],

            'tracking_token' => [
                'nullable',
                'string',
                'size:64',
                'exists:orders,tracking_token',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],

            'restaurant_table_id' => [
                'required_without_all:checkout_token,table_token',
                'exists:restaurant_tables,id',
            ],

            'customer_name' => [
                'required',
                'string',
                'max:100',
            ],

            'payment_method' => [
                'required',
                'in:cash,qris',
            ],

            'items' => [
                'required',
                'array',
                'min:1',
                'max:50',
            ],

            'items.*.product_id' => [
                'required',
                'exists:products,id',
            ],

            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:99',
            ],

            'items.*.notes' => [
                'nullable',
                'string',
                'max:255',
            ],

            // Opsi/varian per item (opsional). Format: [{option_group_id, option_id, label, additional_price}, ...]
            // Validasi pasangan group_id + option_id ditangani di withValidator (lebih andal).
            'items.*.selected_options' => [
                'nullable',
                'array',
            ],
            'items.*.selected_options.*.option_group_id' => [
                'nullable',
                'integer',
                'exists:product_option_groups,id',
            ],
            'items.*.selected_options.*.option_id' => [
                'nullable',
                'integer',
                'exists:product_options,id',
            ],
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            // Token meja dikirim tapi gagal di-resolve (rusak/kedaluwarsa/meja dihapus).
            if ($this->filled('checkout_token') && !$this->input('restaurant_table_id')) {
                $validator->errors()->add(
                    'checkout_token',
                    'Tautan meja tidak valid atau sudah kedaluwarsa. Silakan pindai ulang QR meja.'
                );
            }

            if (!$this->filled('checkout_token') && $this->filled('table_token') && !$this->input('restaurant_table_id')) {
                $validator->errors()->add(
                    'table_token',
                    'Tautan meja tidak valid. Silakan pindai ulang QR meja.'
                );
            }

            $items = $this->input('items') ?? [];
            foreach ($items as $idx => $item) {
                if (!is_array($item) || empty($item['product_id'])) {
                    continue;
                }

                // Opsi harus benar-benar milik produk pada baris ini
                // (bukan sekadar ada di database produk lain).
                $opts = $item['selected_options'] ?? [];
                if (!empty($opts)) {
                    $productId = (int) $item['product_id'];
                    foreach ($opts as $oiIdx => $opt) {
                        $hasGroup = isset($opt['option_group_id']) && !empty($opt['option_group_id']);
                        $hasOption = isset($opt['option_id']) && !empty($opt['option_id']);
                        // Jika hanya salah satu yang ada (tidak berpasangan), tolak
                        if ($hasGroup !== $hasOption) {
                            $validator->errors()->add(
                                "items.{$idx}.selected_options.{$oiIdx}.option_id",
                                "Untuk setiap opsi harus tercantum option_group_id dan option_id secara berpasangan."
                            );
                            continue;
                        }

                        $belongsToProduct = \Illuminate\Support\Facades\DB::table('product_options')
                            ->join('product_option_groups', 'product_options.option_group_id', '=', 'product_option_groups.id')
                            ->where('product_options.id', (int) $opt['option_id'])
                            ->where('product_option_groups.id', (int) $opt['option_group_id'])
                            ->where('product_option_groups.product_id', $productId)
                            ->exists();

                        if (!$belongsToProduct) {
                            $validator->errors()->add(
                                "items.{$idx}.selected_options.{$oiIdx}.option_id",
                                "Opsi tidak milik produk pada baris ini."
                            );
                        }
                    }
                }
            }
        });
    }
}
