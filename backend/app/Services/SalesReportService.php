<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SalesReportService
{
    private const BUSINESS_TIMEZONE = 'Asia/Jakarta';

    private const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    public function dateRange(string $period, string $date): array
    {
        $parsed = Carbon::createFromFormat('Y-m-d', $date, self::BUSINESS_TIMEZONE)->startOfDay();

        if ($period === 'day') {
            $from = $parsed->copy();
            $to = $parsed->copy()->addDay();
        } elseif ($period === 'week') {
            $from = $parsed->copy()->startOfWeek();
            $to = $from->copy()->addWeek();
        } else {
            $from = $parsed->copy()->startOfMonth();
            $to = $from->copy()->addMonth();
        }

        return ['from' => $from, 'to' => $to];
    }

    public function periodLabel(string $period, Carbon $from, Carbon $to): string
    {
        $monthName = fn (Carbon $d) => self::MONTHS[$d->month - 1];

        if ($period === 'day') {
            return $from->format('d') . ' ' . $monthName($from) . ' ' . $from->year;
        }
        if ($period === 'week') {
            $last = $to->copy()->subDay();
            return $from->format('d') . ' ' . $monthName($from) . ' ' . $from->year
                . ' — ' . $last->format('d') . ' ' . $monthName($last) . ' ' . $last->year;
        }

        return $monthName($from) . ' ' . $from->year;
    }

    public function ordersInRange(string $period, string $date): array
    {
        $range = $this->dateRange($period, $date);

        return [
            'from' => $range['from'],
            'to' => $range['to'],
            'label' => $this->periodLabel($period, $range['from'], $range['to']),
            'orders' => Order::with('table')
                ->where('created_at', '>=', $range['from']->copy()->setTimezone('UTC'))
                ->where('created_at', '<', $range['to']->copy()->setTimezone('UTC'))
                ->orderBy('created_at')
                ->get(),
        ];
    }

    public function summary(Carbon $from, Carbon $to): array
    {
        $fromUTC = $from->copy()->setTimezone('UTC');
        $toUTC = $to->copy()->setTimezone('UTC');

        $agg = Order::where('created_at', '>=', $fromUTC)
            ->where('created_at', '<', $toUTC)
            ->selectRaw("COUNT(*) as total_transactions")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_price ELSE 0 END),0) as total_revenue")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_status='paid' AND payment_method='cash' THEN total_price ELSE 0 END),0) as cash")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_status='paid' AND payment_method='qris' THEN total_price ELSE 0 END),0) as qris")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END),0) as paid")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_status!='paid' THEN 1 ELSE 0 END),0) as unpaid")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_status='paid' THEN service_charge ELSE 0 END),0) as service_charge")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_status='paid' THEN tax ELSE 0 END),0) as tax")
            ->first();

        $quantitySold = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.created_at', '>=', $fromUTC)
            ->where('orders.created_at', '<', $toUTC)
            ->where('orders.status', '!=', 'cancelled')
            ->sum('order_items.quantity');

        $profit = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.created_at', '>=', $fromUTC)
            ->where('orders.created_at', '<', $toUTC)
            ->where('orders.status', '!=', 'cancelled')
            ->where('orders.payment_status', 'paid')
            ->sum(DB::raw('(order_items.price - COALESCE(products.cost_price, 0)) * order_items.quantity'));

        return [
            'total_transactions' => (int) ($agg->total_transactions ?? 0),
            'total_revenue' => round((float) ($agg->total_revenue ?? 0), 2),
            'cash' => round((float) ($agg->cash ?? 0), 2),
            'qris' => round((float) ($agg->qris ?? 0), 2),
            'paid' => (int) ($agg->paid ?? 0),
            'unpaid' => (int) ($agg->unpaid ?? 0),
            'quantity_sold' => (int) $quantitySold,
            'service_charge' => round((float) ($agg->service_charge ?? 0), 2),
            'tax' => round((float) ($agg->tax ?? 0), 2),
            'profit' => round((float) $profit, 2),
        ];
    }

    public function topProducts(Carbon $from, Carbon $to, int $limit = 10): array
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.created_at', '>=', $from->copy()->setTimezone('UTC'))
            ->where('orders.created_at', '<', $to->copy()->setTimezone('UTC'))
            ->where('orders.status', '!=', 'cancelled')
            ->groupBy('order_items.product_id', 'products.name')
            ->orderByDesc('total_qty')
            ->limit($limit)
            ->get([
                'order_items.product_id',
                'products.name',
                DB::raw('SUM(order_items.quantity) as total_qty'),
                DB::raw('SUM(order_items.subtotal) as total_revenue'),
            ])
            ->map(fn ($row) => [
                'product_id' => (int) $row->product_id,
                'name' => $row->name,
                'quantity' => (int) $row->total_qty,
                'revenue' => round((float) $row->total_revenue, 2),
            ])->values()->all();
    }

    public function categoryBreakdown(Carbon $from, Carbon $to): array
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->where('orders.created_at', '>=', $from->copy()->setTimezone('UTC'))
            ->where('orders.created_at', '<', $to->copy()->setTimezone('UTC'))
            ->where('orders.status', '!=', 'cancelled')
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('total_qty')
            ->get([
                'categories.id',
                'categories.name',
                DB::raw('SUM(order_items.quantity) as total_qty'),
                DB::raw('SUM(order_items.subtotal) as total_revenue'),
            ])
            ->map(fn ($row) => [
                'category_id' => (int) $row->id,
                'name' => $row->name,
                'quantity' => (int) $row->total_qty,
                'revenue' => round((float) $row->total_revenue, 2),
            ])->values()->all();
    }

    public function previousRange(Carbon $from, Carbon $to): array
    {
        $duration = $from->diffInSeconds($to);
        $prevTo = $from->copy();
        $prevFrom = $from->copy()->subSeconds($duration);
        return [$prevFrom, $prevTo];
    }

    public function createdByLabel(): string
    {
        $user = Auth::user();
        if (!$user) return '-';
        $role = match ($user->role) {
            'admin' => 'Admin',
            'kitchen' => 'Dapur',
            default => 'Kasir',
        };
        return trim($user->name . ' (' . $role . ')');
    }

    public function todayStats(): array
    {
        $tz = self::BUSINESS_TIMEZONE;
        $from = Carbon::now($tz)->startOfDay();
        $to = $from->copy()->addDay();

        $summary = $this->summary($from, $to);

        return [
            'date' => $from->format('Y-m-d'),
            'label' => $this->periodLabel('day', $from, $to),
            'revenue' => $summary['total_revenue'],
            'transactions' => $summary['total_transactions'],
            'paid' => $summary['paid'],
            'unpaid' => $summary['unpaid'],
            'quantity_sold' => $summary['quantity_sold'],
            'profit' => $summary['profit'],
            'average' => $summary['paid'] > 0
                ? round($summary['total_revenue'] / $summary['paid'], 2)
                : 0,
        ];
    }

    public function hourlyRevenue(string $date): array
    {
        $tz = self::BUSINESS_TIMEZONE;
        $from = Carbon::createFromFormat('Y-m-d', $date, $tz)->startOfDay();
        $fromUTC = $from->copy()->setTimezone('UTC');
        $toUTC = $from->copy()->addDay()->setTimezone('UTC');

        $rows = Order::where('created_at', '>=', $fromUTC)
            ->where('created_at', '<', $toUTC)
            ->where('payment_status', 'paid')
            ->where('status', '!=', 'cancelled')
            ->get(['created_at', 'total_price']);

        $buckets = array_fill(0, 24, 0.0);
        foreach ($rows as $order) {
            $h = Carbon::parse($order->created_at)->setTimezone($tz)->hour;
            $buckets[$h] += (float) $order->total_price;
        }

        return array_map(fn ($v) => round($v, 2), $buckets);
    }

    public function paymentSplit(Carbon $from, Carbon $to): array
    {
        $summary = $this->summary($from, $to);

        return [
            'cash' => $summary['cash'],
            'qris' => $summary['qris'],
        ];
    }

    public function getBusinessTimezone(): string
    {
        return self::BUSINESS_TIMEZONE;
    }
}
