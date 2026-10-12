<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardStatsController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\RealtimeController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RestaurantTableController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StockMutationController;
use App\Http\Controllers\Api\UserController;


Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login')->name('login');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});



// PUBLIC / CUSTOMER

Route::get('/categories', [CategoryController::class, 'index'])->middleware('throttle:public');
Route::get('/categories/{category}', [CategoryController::class, 'show'])->middleware('throttle:public');

Route::get('/products', [ProductController::class, 'index'])->middleware('throttle:public');
Route::get('/products/{product}', [ProductController::class, 'show'])->middleware('throttle:public');

Route::get('/restaurant-tables/{restaurantTable}', [RestaurantTableController::class, 'show'])->middleware('throttle:public');

Route::get('/restaurant-tables/{restaurantTable}/qr', [RestaurantTableController::class, 'qrCode'])->middleware('throttle:public');

Route::post('/checkout', [OrderController::class, 'checkout'])->middleware('throttle:checkout');
    Route::get('/orders/track/{trackingToken}', [OrderController::class, 'track'])->middleware('throttle:tracking');
    Route::get('/orders/track/{trackingToken}/events/poll', [RealtimeController::class, 'orderPoll'])->middleware('throttle:tracking');
    Route::post('/orders/track/{trackingToken}/proof', [OrderController::class, 'uploadProof'])->middleware('throttle:checkout');

Route::get('/settings/qris', [SettingsController::class, 'qris'])->middleware('throttle:public');
Route::get('/settings/public', [SettingsController::class, 'publicSettings'])->middleware('throttle:public');

Route::get('/orders/track/{trackingToken}/events', [RealtimeController::class, 'orderStream'])->middleware('throttle:tracking');



// ADMIN


Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {

    Route::apiResource('categories', CategoryController::class)
        ->except(['index', 'show']);

    Route::apiResource('products', ProductController::class)
        ->except(['index', 'show']);

    Route::apiResource('restaurant-tables', RestaurantTableController::class)
        ->except(['index', 'show']);

    Route::apiResource('users', UserController::class);

    Route::get('/settings', [SettingsController::class, 'index']);
    Route::post('/settings/qris', [SettingsController::class, 'updateQris']);
    Route::delete('/settings/qris', [SettingsController::class, 'destroyQris']);
    Route::post('/settings/billing', [SettingsController::class, 'updateBilling']);

    Route::get('/audit-logs', [AuditLogController::class, 'index']);
    Route::get('/stock-mutations', [StockMutationController::class, 'index']);

});



// ADMIN + CASHIER + KITCHEN (operasional)

Route::middleware(['auth:sanctum', 'role:admin,cashier,kitchen'])->group(function () {

    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);

    Route::get('/restaurant-tables', [RestaurantTableController::class, 'index']);

    Route::get('/dashboard/stats', [DashboardStatsController::class, 'index']);

    Route::get('/realtime/events', [RealtimeController::class, 'stream']);
    Route::get('/realtime/events/poll', [RealtimeController::class, 'poll']);

});



// ADMIN + CASHIER (laporan & meja)

Route::middleware(['auth:sanctum', 'role:admin,cashier'])->group(function () {

    Route::get('/reports/sales', [ReportController::class, 'sales']);
    Route::get('/reports/sales/export', [ReportController::class, 'exportSales']);

    Route::patch('/restaurant-tables/{restaurantTable}/status', [RestaurantTableController::class, 'updateStatus']);

});



// ADMIN + CASHIER (status & pembayaran) + KITCHEN (status dapur saja)

Route::middleware(['auth:sanctum', 'role:admin,cashier,kitchen'])->group(function () {

    Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus']);

});

Route::middleware(['auth:sanctum', 'role:admin,cashier'])->group(function () {

    Route::patch('/orders/{order}/payment', [OrderController::class, 'updatePayment']);

});
