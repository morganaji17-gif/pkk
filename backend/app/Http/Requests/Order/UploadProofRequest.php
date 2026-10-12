<?php

namespace App\Http\Requests\Order;

use Illuminate\Foundation\Http\FormRequest;

class UploadProofRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'proof' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'proof.required' => 'Foto bukti pembayaran wajib diunggah.',
            'proof.image' => 'File harus berupa gambar.',
            'proof.mimes' => 'Format gambar harus jpg, png, atau webp.',
            'proof.max' => 'Ukuran gambar maksimal 2MB.',
        ];
    }
}
