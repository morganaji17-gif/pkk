<?php

namespace App\Http\Requests\Order;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
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
                'required',
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
            ],

            'items.*.product_id' => [
                'required',
                'exists:products,id',
            ],

            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
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
            $items = $this->input('items') ?? [];
            foreach ($items as $idx => $item) {
                if (!is_array($item) || empty($item['product_id'])) {
                    continue;
                }
                // Jika ada selected_options, validasi bahwa group_id & option_id punya pasangan lengkap
                $opts = $item['selected_options'] ?? [];
                if (!empty($opts)) {
                    foreach ($opts as $oiIdx => $opt) {
                        $hasGroup = isset($opt['option_group_id']) && !empty($opt['option_group_id']);
                        $hasOption = isset($opt['option_id']) && !empty($opt['option_id']);
                        // Jika hanya salah satu yang ada (tidak berpasangan), tolak
                        if ($hasGroup !== $hasOption) {
                            // Salah satu ada tapi yang lain tidak — tolak
                            $validator->errors()->add(
                                "items.{$idx}.selected_options.{$oiIdx}.option_id",
                                "Untuk setiap opsi harus tercantum option_group_id dan option_id secara berpasangan."
                            );
                        }
                    }
                }
            }
        });
    }
}
