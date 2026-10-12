<?php

namespace App\Http\Requests\Report;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class SalesReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'period' => ['required', 'string', 'in:day,week,month'],
            'date' => ['required', 'string', 'date_format:Y-m-d'],
            'format' => ['nullable', 'string', 'in:pdf,csv'],
        ];
    }

    public function messages(): array
    {
        return [
            'period.required' => 'Periode wajib diisi.',
            'period.in' => 'Periode harus berupa day, week, atau month.',
            'date.required' => 'Tanggal wajib diisi.',
            'date.date_format' => 'Format tanggal harus YYYY-MM-DD.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $date = $this->input('date');

            if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                return;
            }

            $parsed = Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();

            if ($parsed->format('Y-m-d') !== $date) {
                $validator->errors()->add('date', 'Tanggal tidak valid.');
                return;
            }

            if ($parsed->greaterThan(Carbon::today('Asia/Jakarta'))) {
                $validator->errors()->add('date', 'Tanggal tidak boleh berada di masa depan.');
            }
        });
    }
}