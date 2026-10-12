<?php

namespace App\Http\Requests\Order;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'action' => ['sometimes', 'string', 'in:confirm,reject'],
            'reject_note' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'action.in' => 'Aksi harus confirm atau reject.',
            'reject_note.max' => 'Catatan penolakan maksimal 500 karakter.',
        ];
    }
}