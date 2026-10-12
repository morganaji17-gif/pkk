<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan Penjualan</title>
<style>
  @page { size: A4 portrait; margin: 12mm 14mm 20mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f1414; margin: 0; }

  .header-band { background: #7f1d1d; color: #fff; padding: 13px 18px 12px; }
  .header-band .brand { font-size: 22px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; }
  .header-band .doc-title { font-size: 15px; margin-top: 2px; color: #fecaca; }
  .header-band .doc-tag { display: block; margin-top: 7px; font-size: 9px; letter-spacing: 1px; color: #fca5a5; }

  table.meta-box { width: 100%; border-collapse: collapse; margin-top: 12px; background: #fdf6f6; border: 1px solid #f1d5d5; }
  table.meta-box td { padding: 6px 10px; font-size: 10px; }
  table.meta-box td.k { width: 22%; color: #7f1d1d; font-weight: bold; }
  table.meta-box td.v { color: #3a2424; }

  table.detail { width: 100%; border-collapse: collapse; margin-top: 12px; }
  table.detail th { background: #7f1d1d; color: #fff; text-align: left; padding: 7px 8px; font-size: 10px; }
  table.detail td { padding: 6px 8px; border-bottom: 1px solid #f1d5d5; font-size: 10px; color: #2a1a1a; }
  table.detail tr.zebra td { background: #fdf3f3; }
  table.detail td.num, table.detail th.num { text-align: right; white-space: nowrap; }
  .mono { font-family: DejaVu Sans Mono, monospace; font-size: 9px; }
  .status-paid { color: #15803d; font-weight: bold; }
  .status-unpaid { color: #b45309; font-weight: bold; }

  .no-data { margin: 28px 0; text-align: center; font-size: 13px; color: #7f1d1d; border: 1px dashed #f1d5d5; background: #fdf6f6; padding: 22px; }

  .summary { margin-top: 18px; }
  .summary-title { font-size: 12px; font-weight: bold; color: #7f1d1d; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #7f1d1d; padding-bottom: 4px; margin-bottom: 8px; }
  .summary table { width: 100%; border-collapse: collapse; }
  .summary td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #f1d5d5; }
  .summary td.num { text-align: right; font-weight: bold; }
  .summary tr.total td { background: #7f1d1d; color: #fff; border-bottom: 0; }
  .summary tr.total td.num { font-size: 13px; }

  .extra-block { margin-top: 14px; }
  .extra-title { font-size: 11px; font-weight: bold; color: #7f1d1d; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e9c1c1; padding-bottom: 3px; margin-bottom: 6px; }
  table.extra { width: 100%; border-collapse: collapse; }
  table.extra th { background: #f3d5d5; color: #7f1d1d; text-align: left; padding: 5px 8px; font-size: 10px; }
  table.extra td { padding: 5px 8px; border-bottom: 1px solid #f1d5d5; font-size: 10px; color: #2a1a1a; }
  table.extra td.num, table.extra th.num { text-align: right; white-space: nowrap; }
  .compare-box { background: #fdf6f6; border: 1px solid #f1d5d5; padding: 8px 10px; font-size: 10px; color: #3a2424; }
</style>
</head>
<body>
  <div class="header-band">
    <div class="brand">Pesanin</div>
    <div class="doc-title">Laporan Penjualan</div>
    <span class="doc-tag">DOKUMEN RESMI — RINGKASAN TRANSAKSI</span>
  </div>

  <table class="meta-box">
    <tr>
      <td class="k">Periode</td>
      <td class="v">{{ $label }}</td>
      <td class="k">Jumlah Transaksi</td>
      <td class="v">{{ $summary['total_transactions'] }}</td>
    </tr>
    <tr>
      <td class="k">Tanggal Dibuat</td>
      <td class="v">{{ $generatedAt->format('d/m/Y H:i') }} WIB</td>
      <td class="k">Dibuat Oleh</td>
      <td class="v">{{ $createdBy }}</td>
    </tr>
  </table>

  @if ($orders->isEmpty())
    <div class="no-data">Tidak ada data transaksi pada periode ini.</div>
  @else
    <table class="detail">
      <thead>
        <tr>
          <th>No. Order</th>
          <th>Tanggal</th>
          <th>Customer</th>
          <th>Meja</th>
          <th>Metode</th>
          <th>Status</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        @foreach ($orders as $order)
          <tr class="@if ($loop->even) zebra @endif">
            <td class="mono">{{ $order->order_number }}</td>
            <td>{{ \Illuminate\Support\Carbon::parse($order->created_at)->setTimezone('Asia/Jakarta')->format('d/m/Y H:i') }}</td>
            <td>{{ $order->customer_name }}</td>
            <td>Meja {{ $order->table?->table_number ?? '-' }}</td>
            <td>{{ $order->payment_method === 'qris' ? 'QRIS' : ($order->payment_method === 'cash' ? 'Cash' : '-') }}</td>
            <td class="{{ $order->payment_status === 'paid' ? 'status-paid' : 'status-unpaid' }}">{{ $order->payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar' }}</td>
            <td class="num">Rp {{ number_format((float) $order->total_price, 0, ',', '.') }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  @endif

  <div class="summary">
    <div class="summary-title">Ringkasan</div>
    <table>
      <tr>
        <td>Total Transaksi</td>
        <td class="num">{{ $summary['total_transactions'] }} pesanan</td>
      </tr>
      <tr class="total">
        <td>Total Pendapatan (Lunas)</td>
        <td class="num">Rp {{ number_format((float) $summary['total_revenue'], 0, ',', '.') }}</td>
      </tr>
      <tr>
        <td>Cash</td>
        <td class="num">Rp {{ number_format((float) $summary['cash'], 0, ',', '.') }}</td>
      </tr>
      <tr>
        <td>QRIS</td>
        <td class="num">Rp {{ number_format((float) $summary['qris'], 0, ',', '.') }}</td>
      </tr>
      <tr>
        <td>Service Charge</td>
        <td class="num">Rp {{ number_format((float) $summary['service_charge'], 0, ',', '.') }}</td>
      </tr>
      <tr>
        <td>PPN</td>
        <td class="num">Rp {{ number_format((float) $summary['tax'], 0, ',', '.') }}</td>
      </tr>
      <tr>
        <td>Total Produk Terjual</td>
        <td class="num">{{ $summary['quantity_sold'] }} porsi</td>
      </tr>
      <tr>
        <td>Lunas / Belum Dibayar</td>
        <td class="num">{{ $summary['paid'] }} / {{ $summary['unpaid'] }}</td>
      </tr>
      <tr class="total">
        <td>Estimasi Laba (Pendapatan − HPP)</td>
        <td class="num">Rp {{ number_format((float) $summary['profit'], 0, ',', '.') }}</td>
      </tr>
    </table>
  </div>

  <div class="extra-block">
    <div class="extra-title">Perbandingan dengan Periode Sebelumnya</div>
    <div class="compare-box">
      Transaksi: {{ $comparison['total_transactions'] }} — Pendapatan:
      Rp {{ number_format((float) $comparison['total_revenue'], 0, ',', '.') }} — Produk Terjual:
      {{ $comparison['quantity_sold'] }}
    </div>
  </div>

  @if (count($topProducts) > 0)
    <div class="extra-block">
      <div class="extra-title">Produk Terlaris</div>
      <table class="extra">
        <thead>
          <tr>
            <th>Produk</th>
            <th class="num">Terjual</th>
            <th class="num">Pendapatan</th>
          </tr>
        </thead>
        <tbody>
          @foreach ($topProducts as $row)
            <tr>
              <td>{{ $row['name'] }}</td>
              <td class="num">{{ $row['quantity'] }}</td>
              <td class="num">Rp {{ number_format((float) $row['revenue'], 0, ',', '.') }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>
  @endif

  @if (count($categoryBreakdown) > 0)
    <div class="extra-block">
      <div class="extra-title">Rincian Per Kategori</div>
      <table class="extra">
        <thead>
          <tr>
            <th>Kategori</th>
            <th class="num">Terjual</th>
            <th class="num">Pendapatan</th>
          </tr>
        </thead>
        <tbody>
          @foreach ($categoryBreakdown as $row)
            <tr>
              <td>{{ $row['name'] }}</td>
              <td class="num">{{ $row['quantity'] }}</td>
              <td class="num">Rp {{ number_format((float) $row['revenue'], 0, ',', '.') }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>
  @endif
</body>
</html>