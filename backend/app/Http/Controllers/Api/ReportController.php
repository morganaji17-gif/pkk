<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Report\SalesReportRequest;
use App\Models\Order;
use App\Services\SalesReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;

class ReportController extends Controller
{
    public function __construct(private SalesReportService $reportService) {}

    private function sanitizeCsvValue(string $value): string
    {
        if ($value !== '' && preg_match('/^[=+\-@\t\r]/', $value)) {
            return "'" . $value;
        }
        return $value;
    }

    public function sales(SalesReportRequest $request)
    {
        $period = $request->input('period');
        $date = $request->input('date');

        $result = $this->reportService->ordersInRange($period, $date);
        [$prevFrom, $prevTo] = $this->reportService->previousRange($result['from'], $result['to']);

        return response()->json([
            'message' => 'Sales report retrieved successfully',
            'data' => [
                'period' => $period,
                'date' => $date,
                'label' => $result['label'],
                'from' => $result['from']->toIso8601String(),
                'to' => $result['to']->toIso8601String(),
                'summary' => $this->reportService->summary($result['from'], $result['to']),
                'comparison' => $this->reportService->summary($prevFrom, $prevTo),
                'top_products' => $this->reportService->topProducts($result['from'], $result['to']),
                'category_breakdown' => $this->reportService->categoryBreakdown($result['from'], $result['to']),
                'orders' => $result['orders']->map(function (Order $order) {
                    return [
                        'id' => $order->id,
                        'order_number' => $order->order_number,
                        'created_at' => $order->created_at,
                        'customer_name' => $order->customer_name,
                        'table_number' => $order->table?->table_number,
                        'payment_method' => $order->payment_method,
                        'payment_status' => $order->payment_status,
                        'paid_at' => $order->paid_at,
                        'subtotal' => round((float) $order->subtotal, 2),
                        'service_charge' => round((float) $order->service_charge, 2),
                        'tax' => round((float) $order->tax, 2),
                        'total_price' => (float) $order->total_price,
                    ];
                })->values(),
            ],
        ]);
    }

    public function exportSales(SalesReportRequest $request)
    {
        $period = $request->input('period');
        $date = $request->input('date');

        if ($request->input('format') === 'csv') {
            return $this->exportCsv($period, $date);
        }

        $result = $this->reportService->ordersInRange($period, $date);
        [$prevFrom, $prevTo] = $this->reportService->previousRange($result['from'], $result['to']);

        $pdf = Pdf::loadView('reports.sales', [
            'label' => $result['label'],
            'period' => $period,
            'date' => $date,
            'generatedAt' => Carbon::now($this->reportService->getBusinessTimezone()),
            'createdBy' => $this->reportService->createdByLabel(),
            'orders' => $result['orders'],
            'summary' => $this->reportService->summary($result['from'], $result['to']),
            'comparison' => $this->reportService->summary($prevFrom, $prevTo),
            'topProducts' => $this->reportService->topProducts($result['from'], $result['to']),
            'categoryBreakdown' => $this->reportService->categoryBreakdown($result['from'], $result['to']),
        ])->setPaper('a4', 'portrait');

        $dompdf = $pdf->getDomPDF();
        $dompdf->render();

        $fontMetrics = $dompdf->getFontMetrics();
        $font = $fontMetrics->getFont('DejaVu Sans', 'normal');
        $canvas = $dompdf->getCanvas();
        $canvas->line(40, 809, 555, 809, [205, 205, 205], 0.8);
        $canvas->page_text(245, 821, 'Halaman {PAGE_NUM} dari {PAGE_COUNT}', $font, 9, [120, 120, 120]);

        return response($dompdf->output())
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'attachment; filename="laporan-penjualan-' . $date . '.pdf"');
    }

    private function exportCsv(string $period, string $date)
    {
        $result = $this->reportService->ordersInRange($period, $date);
        [$prevFrom, $prevTo] = $this->reportService->previousRange($result['from'], $result['to']);
        $summary = $this->reportService->summary($result['from'], $result['to']);
        $comparison = $this->reportService->summary($prevFrom, $prevTo);
        $topProducts = $this->reportService->topProducts($result['from'], $result['to']);
        $categoryBreakdown = $this->reportService->categoryBreakdown($result['from'], $result['to']);

        $lines = [];

        $lines[] = ['No', 'Tanggal', 'Nomor Order', 'Customer', 'Meja', 'Metode', 'Pembayaran', 'Subtotal', 'Layanan', 'PPN', 'Total'];
        foreach ($result['orders'] as $i => $order) {
            $lines[] = [
                $i + 1,
                $order->created_at->copy()->setTimezone($this->reportService->getBusinessTimezone())->format('Y-m-d H:i'),
                $order->order_number,
                $order->customer_name,
                $order->table?->table_number ?? '',
                $order->payment_method,
                $order->payment_status,
                $order->subtotal,
                $order->service_charge,
                $order->tax,
                $order->total_price,
            ];
        }

        $lines[] = [];
        $lines[] = ['RINGKASAN'];
        $lines[] = ['Total Transaksi', $summary['total_transactions']];
        $lines[] = ['Pendapatan (Lunas)', $summary['total_revenue']];
        $lines[] = ['Cash', $summary['cash']];
        $lines[] = ['QRIS', $summary['qris']];
        $lines[] = ['Transaksi Lunas', $summary['paid']];
        $lines[] = ['Belum Dibayar', $summary['unpaid']];
        $lines[] = ['Produk Terjual', $summary['quantity_sold']];
        $lines[] = ['Service Charge', $summary['service_charge']];
        $lines[] = ['PPN', $summary['tax']];
        $lines[] = ['Estimasi Laba', $summary['profit']];
        $lines[] = ['Perbandingan Periode Sebelumnya', ''];
        $lines[] = ['Total Transaksi', $comparison['total_transactions']];
        $lines[] = ['Pendapatan', $comparison['total_revenue']];
        $lines[] = ['Produk Terjual', $comparison['quantity_sold']];

        $lines[] = [];
        $lines[] = ['PRODUK TERLARIS', 'Jumlah', 'Pendapatan'];
        foreach ($topProducts as $row) {
            $lines[] = [$row['name'], $row['quantity'], $row['revenue']];
        }

        $lines[] = [];
        $lines[] = ['RINCIAN PER KATEGORI', 'Jumlah', 'Pendapatan'];
        foreach ($categoryBreakdown as $row) {
            $lines[] = [$row['name'], $row['quantity'], $row['revenue']];
        }

        $csv = "\xEF\xBB\xBF";
        foreach ($lines as $line) {
            $escaped = array_map(function ($value) {
                $value = $this->sanitizeCsvValue((string) $value);
                return '"' . str_replace('"', '""', $value) . '"';
            }, $line);
            $csv .= implode(',', $escaped) . "\r\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv; charset=UTF-8')
            ->header('Content-Disposition', 'attachment; filename="laporan-penjualan-' . $date . '.csv"');
    }
}
