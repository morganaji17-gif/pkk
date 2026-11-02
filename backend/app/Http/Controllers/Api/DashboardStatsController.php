<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Services\SalesReportService;
use Illuminate\Support\Carbon;

class DashboardStatsController extends Controller
{
    public function index(SalesReportService $reports)
    {
        $tz = $reports->getBusinessTimezone();

        $orderStats = \Illuminate\Support\Facades\DB::table('orders')
            ->selectRaw("COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders")
            ->selectRaw("COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders")
            ->selectRaw("COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_orders")
            ->selectRaw("COUNT(CASE WHEN status = 'served' THEN 1 END) as ready_orders")
            ->selectRaw("COUNT(CASE WHEN payment_status = 'unpaid' AND status != 'cancelled' THEN 1 END) as unpaid_orders")
            ->selectRaw("COUNT(CASE WHEN proof_image IS NOT NULL AND payment_status = 'unpaid' AND status NOT IN ('cancelled','completed') THEN 1 END) as pending_proofs")
            ->selectRaw("COUNT(DISTINCT CASE WHEN status IN ('pending','confirmed','preparing','served') THEN restaurant_table_id END) as occupied_tables")
            ->first();

        $today = $reports->todayStats();

        // Bukti pembayaran QRIS yang menunggu verifikasi (dengan URL bukti, meja & total).
        $pendingProofs = Order::with('table')
            ->whereNotNull('proof_image')
            ->where('payment_status', 'unpaid')
            ->whereNotIn('status', ['cancelled', 'completed'])
            ->orderBy('proof_uploaded_at')
            ->limit(8)
            ->get([
                'id',
                'order_number',
                'restaurant_table_id',
                'customer_name',
                'status',
                'total_price',
                'proof_image',
                'proof_uploaded_at',
            ])
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->customer_name,
                'table' => $order->table?->table_number,
                'status' => $order->status,
                'total_price' => (float) $order->total_price,
                'proof_url' => $order->proof_url,
                'uploaded_at' => $order->proof_uploaded_at?->toIso8601String(),
            ])->values()->all();

        // Perbandingan pendapatan vs kemarin (sudah lunas).
        $todayStart = Carbon::now($tz)->startOfDay();
        $yesterdayStart = $todayStart->copy()->subDay();
        $yesterdayRevenue = (float) Order::where('created_at', '>=', $yesterdayStart->copy()->setTimezone('UTC'))
            ->where('created_at', '<', $todayStart->copy()->setTimezone('UTC'))
            ->where('payment_status', 'paid')
            ->sum('total_price');

        // Produk terlaris hari ini (maksimal 5).
        $topProducts = $reports->topProducts($todayStart->copy(), $todayStart->copy()->addDay(), 5);

        return response()->json([
            'message' => 'Dashboard stats retrieved successfully',
            'data' => [
                'pending_orders' => (int) ($orderStats->pending_orders ?? 0),
                'confirmed_orders' => (int) ($orderStats->confirmed_orders ?? 0),
                'preparing_orders' => (int) ($orderStats->preparing_orders ?? 0),
                'ready_orders' => (int) ($orderStats->ready_orders ?? 0),
                'unpaid_orders' => (int) ($orderStats->unpaid_orders ?? 0),
                'pending_proofs' => (int) ($orderStats->pending_proofs ?? 0),
                'low_stock_count' => Product::where('is_active', true)
                    ->where('stock', '<=', Product::LOW_STOCK_THRESHOLD)
                    ->count(),
                'maintenance_tables' => RestaurantTable::where('status', 'maintenance')->count(),
                'occupied_tables' => (int) ($orderStats->occupied_tables ?? 0),
                'today_revenue' => $today['revenue'],
                'today_transactions' => $today['transactions'],
                'today_paid' => $today['paid'],
                'today_unpaid' => $today['unpaid'],
                'today_quantity' => $today['quantity_sold'],
                'today_profit' => $today['profit'],
                'today_average' => $today['average'],
                'today_label' => $today['label'],
                'yesterday_revenue' => $yesterdayRevenue,
                'pending_proof_list' => $pendingProofs,
                'today_top_products' => $topProducts,
            ],
        ]);
    }
}
