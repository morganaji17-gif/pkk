<?php

namespace App\Http\Requests\StockMutation;

use Illuminate\Foundation\Http\FormRequest;

class IndexStockMutationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'reason' => ['nullable', 'string', 'in:checkout,append,cancel,create,update,manual'],
            'from' => ['nullable', 'date', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date', 'date_format:Y-m-d', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
        ];
    }
}