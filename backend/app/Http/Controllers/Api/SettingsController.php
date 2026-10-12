<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Setting\UpdateBillingRequest;
use App\Http\Requests\Setting\UpdateQrisRequest;
use App\Models\Setting;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\Storage;

class SettingsController extends Controller
{
    public function index()
    {
        return response()->json([
            'message' => 'Settings retrieved successfully',
            'data' => [
                'qris_image' => Setting::get('qris_image'),
                'qris_instruction' => Setting::get('qris_instruction'),
                'service_charge_percent' => (float) Setting::get('service_charge_percent', 0),
                'tax_percent' => (float) Setting::get('tax_percent', 0),
            ],
        ]);
    }

    public function publicSettings()
    {
        return response()->json([
            'message' => 'Public settings retrieved successfully',
            'data' => [
                'image_url' => ($path = Setting::get('qris_image')) ? Storage::url($path) : null,
                'instruction' => Setting::get('qris_instruction'),
                'service_charge_percent' => (float) Setting::get('service_charge_percent', 0),
                'tax_percent' => (float) Setting::get('tax_percent', 0),
            ],
        ]);
    }

    public function updateBilling(UpdateBillingRequest $request)
    {
        $validated = $request->validated();

        $old = [
            'service_charge_percent' => (float) Setting::get('service_charge_percent', 0),
            'tax_percent' => (float) Setting::get('tax_percent', 0),
        ];

        Setting::set('service_charge_percent', (string) $validated['service_charge_percent']);
        Setting::set('tax_percent', (string) $validated['tax_percent']);

        AuditLogger::record(
            'settings_updated',
            'settings',
            null,
            'Pengaturan biaya layanan dan pajak diperbarui',
            $old,
            $validated
        );

        return response()->json([
            'message' => 'Billing settings updated successfully',
            'data' => [
                'service_charge_percent' => (float) Setting::get('service_charge_percent', 0),
                'tax_percent' => (float) Setting::get('tax_percent', 0),
            ],
        ]);
    }

    public function updateQris(UpdateQrisRequest $request)
    {
        $validated = $request->validated();

        if ($request->hasFile('image')) {
            $old = Setting::get('qris_image');
            if ($old) {
                Storage::disk('public')->delete($old);
            }
            $path = $request->file('image')->store('qris', 'public');
            Setting::set('qris_image', $path);
        }

        if (array_key_exists('instruction', $validated)) {
            Setting::set('qris_instruction', $validated['instruction']);
        }

        return response()->json([
            'message' => 'QRIS settings updated successfully',
            'data' => [
                'qris_image' => Setting::get('qris_image'),
                'qris_instruction' => Setting::get('qris_instruction'),
            ],
        ]);
    }

    public function qris()
    {
        $path = Setting::get('qris_image');

        return response()->json([
            'message' => 'QRIS settings retrieved successfully',
            'data' => [
                'image_url' => $path ? Storage::url($path) : null,
                'instruction' => Setting::get('qris_instruction'),
            ],
        ]);
    }

    public function destroyQris()
    {
        $old = Setting::get('qris_image');
        if ($old) {
            Storage::disk('public')->delete($old);
        }
        Setting::set('qris_image', null);
        Setting::set('qris_instruction', null);

        return response()->json([
            'message' => 'QRIS settings removed successfully',
            'data' => [
                'qris_image' => null,
                'qris_instruction' => null,
            ],
        ]);
    }
}