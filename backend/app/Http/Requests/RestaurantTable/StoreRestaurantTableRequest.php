<?php

namespace App\Http\Requests\RestaurantTable;

use Illuminate\Foundation\Http\FormRequest;

class StoreRestaurantTableRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
{
    return [
        'table_number' => ['required', 'string', 'unique:restaurant_tables,table_number'],
        'capacity' => ['required', 'integer', 'min:1'],
        'qr_code' => ['nullable', 'string'],
        'is_available' => ['sometimes', 'boolean'],
        'status' => ['nullable', 'in:available,maintenance'],
    ];
}
}
