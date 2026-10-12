<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RestaurantTable;
use App\Http\Requests\RestaurantTable\StoreRestaurantTableRequest;
use App\Http\Requests\RestaurantTable\UpdateRestaurantTableRequest;
use App\Http\Requests\RestaurantTable\UpdateTableStatusRequest;
use App\Services\AuditLogger;
use App\Services\Realtime;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class RestaurantTableController extends Controller
{
    public function qrCode(RestaurantTable $restaurantTable)
{
    $url = rtrim(config('app.frontend_url'), '/') . '/menu?table=' . $restaurantTable->id;

    $qr = QrCode::size(300)->generate($url);

    return response($qr)
        ->header('Content-Type', 'image/svg+xml');
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
     */
    public function show(RestaurantTable $restaurantTable)
{
    return response()->json([
        'message' => 'Restaurant table retrieved successfully',
        'data' => $restaurantTable,
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
