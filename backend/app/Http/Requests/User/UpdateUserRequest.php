<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->route('user')->id;

        return [
            'name' => ['sometimes', 'string', 'max:100'],
            'email' => [
                'sometimes',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'max:255'],
            'role' => ['sometimes', 'string', 'in:admin,cashier,kitchen'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.max' => 'Nama tidak boleh lebih dari 100 karakter.',
            'email.email' => 'Email tidak valid.',
            'email.unique' => 'Email sudah digunakan.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
            'role.in' => 'Peran harus berupa admin, kasir, atau dapur.',
        ];
    }
}