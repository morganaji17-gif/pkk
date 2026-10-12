<?php

namespace App\Http\Requests\Order;

use Illuminate\Foundation\Http\FormRequest;

class IndexOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'in:pending,confirmed,preparing,served,completed,cancelled'],
            'payment_status' => ['nullable', 'string', 'in:paid,unpaid'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'search.max' => 'Pencarian tidak boleh lebih dari 100 karakter.',
            'status.in' => 'Status harus berupa pending, confirmed, preparing, served, completed, atau cancelled.',
            'payment_status.in' => 'Status pembayaran harus berupa paid atau unpaid.',
            'page.min' => 'Nomor halaman tidak valid.',
            'per_page.min' => 'Jumlah item per halaman tidak valid.',
            'per_page.max' => 'Jumlah item per halaman maksimal 100.',
        ];
    }
}