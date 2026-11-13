<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\RestaurantTable;
use Illuminate\Support\Facades\DB;
use App\Http\Requests\RestaurantTable\StoreRestaurantTableRequest;
use App\Http\Requests\RestaurantTable\UpdateRestaurantTableRequest;
use App\Http\Requests\RestaurantTable\UpdateTableStatusRequest;
use App\Services\AuditLogger;
use App\Services\Realtime;
use App\Services\TableAccessService;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class RestaurantTableController extends Controller
{
    public function qrCode(RestaurantTable $restaurantTable)
{
    $url = TableAccessService::qrUrl($restaurantTable);

    $qr = QrCode::size(300)->generate($url);

    return response($qr)
        ->header('Content-Type', 'image/svg+xml');
}

    /**
     * Resolve meja dari token publik (URL QR baru: /menu?t=...).
     * Hanya mengembalikan data yang dibutuhkan menu + checkout_token
     * jangka pendek. public_token tidak pernah dikembalikan di sini.
     */
    public function resolveByToken(string $token, TableAccessService $access)
    {
        if (strlen($token) < 16) {
            abort(404);
        }

        $table = RestaurantTable::where('public_token', $token)->first();

        if (!$table) {
            abort(404);
        }

        return response()->json([
            'message' => 'Restaurant table resolved successfully',
            'data' => [
                'id' => $table->id,
                'table_number' => $table->table_number,
                'capacity' => $table->capacity,
                'is_available' => $table->is_available,
                'status' => $table->status,
                'effective_status' => $table->effective_status,
                'checkout_token' => $access->issueCheckoutToken($table),
            ],
        ]);
    }

    /**
     * Rotasi token publik meja (admin). URL QR lama langsung tidak berlaku.
     */
    public function rotateToken(RestaurantTable $restaurantTable)
    {
        $restaurantTable->forceFill(['public_token' => \Illuminate\Support\Str::random(48)])->save();

        Realtime::push('tables', ['type' => 'table.changed']);
        AuditLogger::record(
            'token_rotated',
            'restaurant_table',
            $restaurantTable->id,
            'Token QR meja ' . $restaurantTable->table_number . ' diperbarui'
        );

        return response()->json([
            'message' => 'Table token rotated successfully',
            'data' => $restaurantTable->fresh(),
        ]);
    }

    public function index(\Illuminate\Http\Request $request)
{
    $page = (int) $request->input('page', 1);
    $perPage = (int) $request->input('per_page', 15);
    $perPage = max(1, min($perPage, 50));

    $tables = RestaurantTable::withCount('activeOrders')->latest()->paginate($perPage, ['*'], 'page', $page);

    return response()->json([
        'message' => 'Restaurant tables retrieved successfully',
        'data' => $tables->items(),
        'meta' => [
            'current_page' => $tables->currentPage(),
            'last_page' => $tables->lastPage(),
            'per_page' => $tables->perPage(),
            'total' => $tables->total(),
            'has_more' => $tables->hasMorePages(),
        ],
    ]);
}
    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreRestaurantTableRequest $request)
{
    $data = $request->validated();

    if (array_key_exists('status', $data)) {
        $data['is_available'] = $data['status'] !== 'maintenance';
    } else {
        $data['status'] = 'available';
        $data['is_available'] = $data['is_available'] ?? true;
    }

    $table = RestaurantTable::create($data);

    Realtime::push('tables', ['type' => 'table.changed']);
    Realtime::push('dashboard', ['type' => 'tables.changed']);
    AuditLogger::record(
        'created',
        'restaurant_table',
        $table->id,
        'Meja ' . $table->table_number . ' dibuat'
    );

    return response()->json([
        'message' => 'Restaurant table created successfully',
        'data' => $table,
    ], 201);
}

    /**
     * Display the specified resource.
     *
     * Endpoint PUBLIK (legacy QR `?table={id}`). Jangan pernah bocorkan
     * public_token permanen di sini — cukup data tampilan + checkout_token
     * jangka pendek.
     */
    public function show(RestaurantTable $restaurantTable, TableAccessService $access)
{
    $safe = $restaurantTable->makeHidden('public_token');

    return response()->json([
        'message' => 'Restaurant table retrieved successfully',
        'data' => array_merge($safe->toArray(), [
            'checkout_token' => $access->issueCheckoutToken($restaurantTable),
        ]),
    ]);
}

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateRestaurantTableRequest $request, RestaurantTable $restaurantTable)
{
    $old = $restaurantTable->only(['table_number', 'capacity', 'status']);

    $data = $request->validated();

    if (array_key_exists('status', $data)) {
        $data['is_available'] = $data['status'] !== 'maintenance';
    }

    $restaurantTable->update($data);

    Realtime::push('tables', ['type' => 'table.changed']);
    Realtime::push('dashboard', ['type' => 'tables.changed']);
    AuditLogger::record(
        'updated',
        'restaurant_table',
        $restaurantTable->id,
        'Meja ' . $restaurantTable->table_number . ' diperbarui',
        $old,
        $restaurantTable->only(['table_number', 'capacity', 'status'])
    );

    return response()->json([
        'message' => 'Restaurant table updated successfully',
        'data' => $restaurantTable,
    ]);
}

public function updateStatus(UpdateTableStatusRequest $request, RestaurantTable $restaurantTable)
{
    $old = $restaurantTable->status;

    $restaurantTable->update([
        'status' => $request->status,
        'is_available' => $request->status !== 'maintenance',
    ]);

    Realtime::push('tables', ['type' => 'table.status_changed']);
    Realtime::push('dashboard', ['type' => 'tables.changed']);
    AuditLogger::record(
        'status_changed',
        'restaurant_table',
        $restaurantTable->id,
        'Status meja ' . $restaurantTable->table_number . ' berubah dari ' . $old . ' menjadi ' . $request->status,
        ['status' => $old],
        ['status' => $request->status]
    );

    return response()->json([
        'message' => 'Restaurant table status updated successfully',
        'data' => $restaurantTable,
    ]);
}

    /**
     * Kosongkan meja: selesaikan semua pesanan aktif di meja ini.
     * Dipakai kasir setelah tamu selesai & meninggalkan meja.
     *
     * Pesanan ditandai `completed` (bukan `cancelled`) supaya stok yang
     * sudah terpakai tidak dikembalikan dan omzet tetap tercatat.
     *
     * Jika ada pesanan belum lunas, operasi dibatalkan — kasir harus
     * mengkonfirmasi pembayaran lebih dulu.
     */
    public function clear(RestaurantTable $restaurantTable)
    {
        $orders = Order::where('restaurant_table_id', $restaurantTable->id)
            ->whereIn('status', Order::OCCUPYING_STATUSES)
            ->get();

        if ($orders->isEmpty()) {
            return response()->json([
                'message' => 'Table cleared successfully',
                'data' => [
                    'cleared_orders' => 0,
                    'table' => $restaurantTable->fresh(),
                ],
            ]);
        }

        $unpaidCount = $orders->filter(fn($o) => $o->payment_status !== 'paid')->count();
        if ($unpaidCount > 0) {
            return response()->json([
                'message' => 'Meja memiliki pesanan belum lunas. Konfirmasi pembayaran lebih dulu.',
                'errors' => ['table' => ["{$unpaidCount} pesanan belum dibayar — selesaikan pembayaran sebelum mengosongkan meja."]],
            ], 422);
        }

        return DB::transaction(function () use ($restaurantTable, $orders) {
            $cleared = 0;
            foreach ($orders as $order) {
                $order->status = 'completed';
                $order->save();
                $cleared++;
            }

            Realtime::push('orders', [
                'type' => 'orders.cleared',
                'table' => $restaurantTable->table_number,
                'count' => $cleared,
            ]);
            Realtime::push('tables', ['type' => 'table.changed']);
            Realtime::push('dashboard', ['type' => 'orders.changed']);

            AuditLogger::record(
                'table_cleared',
                'restaurant_table',
                $restaurantTable->id,
                'Meja ' . $restaurantTable->table_number . ' dikosongkan (' . $cleared . ' pesanan diselesaikan)'
            );

            return response()->json([
                'message' => 'Table cleared successfully',
                'data' => [
                    'cleared_orders' => $cleared,
                    'table' => $restaurantTable->fresh(),
                ],
            ]);
        });
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(RestaurantTable $restaurantTable)
{
    $number = $restaurantTable->table_number;

    $restaurantTable->delete();

    Realtime::push('tables', ['type' => 'table.changed']);
    AuditLogger::record(
        'deleted',
        'restaurant_table',
        $restaurantTable->id,
        'Meja ' . $number . ' dihapus'
    );

    return response()->json([
        'message' => 'Restaurant table deleted successfully',
    ]);
}
}
