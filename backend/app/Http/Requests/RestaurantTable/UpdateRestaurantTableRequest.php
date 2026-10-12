<?php

namespace App\Http\Requests\RestaurantTable;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRestaurantTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'table_number' => [
                'required',
                'string',
                Rule::unique('restaurant_tables', 'table_number')->ignore($this->restaurant_table),
            ],
            'capacity' => ['required', 'integer', 'min:1'],
            'qr_code' => ['nullable', 'string'],
            'is_available' => ['sometimes', 'boolean'],
            'status' => ['nullable', 'in:available,maintenance'],
        ];
    }
}