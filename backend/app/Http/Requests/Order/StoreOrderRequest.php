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
        ];
    }
}