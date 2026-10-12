import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import RevenueTrendChart from '../../components/charts/RevenueTrendChart'
import StatusBreakdown from '../../components/charts/StatusBreakdown'
import LowStockSection from '../../components/LowStockSection'
import { useDashboardStats } from '../../context/DashboardStatsContext'
import { useDayReport, useWeeklyReport } from '../../hooks/useReports'
import { useRecentOrders } from '../../hooks/useRecentOrders'
import { formatRupiah, localDateStr } from '../../../utils/format'
import { prefetchIdle } from '../../../prefetch/prefetch'

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function buildDailySeries(report) {
  if (!report?.from || !Array.isArray(report.orders)) return []

  const start = new Date(report.from)
  const buckets = []
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    buckets.push({ key: localDateStr(d), label: DAY_LABELS[d.getDay()], value: 0 })
  }

  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const order of report.orders) {
    if (order.payment_status !== 'paid') continue
    const bucket = byKey.get(localDateStr(new Date(order.created_at)))
    if (bucket) bucket.value += Number(order.total_price) || 0
  }
  return buckets
}

function countStatuses(report) {
  const counts = { pending: 0, confirmed: 0, preparing: 0, served: 0, completed: 0, cancelled: 0 }
  for (const order of report?.orders || []) {
    if (order.status in counts) counts[order.status] += 1
  }
  return counts
}

const STATUS_LABELS = {
  pending: 'Menunggu',
  confirmed: 'Diterima',
  preparing: 'Dibuat',
  served: 'Siap',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

export default function AdminDashboard() {
  const stats = useDashboardStats()
  const day = useDayReport()
  const week = useWeeklyReport()
  const { orders: recentOrders, loading: recentLoading } = useRecentOrders()

  useEffect(() => {
    prefetchIdle('/admin')
  }, [])

  const series = useMemo(() => buildDailySeries(week.report), [week.report])
  const statusCounts = useMemo(() => countStatuses(day.report), [day.report])
  const summary = day.report?.summary

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="staff-dashboard">
      <header className="dash-header">
        <h1 className="dash-header__title">Dashboard</h1>
        <p className="dash-header__date">{todayLabel}</p>
        <p className="dash-header__ops">
          <span>
            <strong className={stats.pending_orders > 0 ? 'is-alert' : ''}>
              {stats.pending_orders}
            </strong>{' '}
            pesanan menunggu
          </span>
          <span aria-hidden="true" className="dash-header__sep">
            &middot;
          </span>
          <span>
            <strong>{stats.occupied_tables}</strong> meja terisi
          </span>
          <span aria-hidden="true" className="dash-header__sep">
            &middot;
          </span>
          <span>
            <strong className={stats.low_stock_count > 0 ? 'is-alert' : ''}>
              {stats.low_stock_count}
            </strong>{' '}
            stok kritis
          </span>
        </p>
      </header>

      <dl className="dash-metrics">
        {day.loading || !summary ? (
          <div className="dash-metrics__empty chart-empty">Memuat ringkasan hari ini&hellip;</div>
        ) : (
          <>
            <div className="dash-metrics__item">
              <dt>Pendapatan hari ini</dt>
              <dd>{formatRupiah(stats.today_revenue || summary.total_revenue)}</dd>
            </div>
            <div className="dash-metrics__item">
              <dt>Transaksi</dt>
              <dd>{stats.today_transactions || summary.total_transactions}</dd>
            </div>
            <div className="dash-metrics__item">
              <dt>Produk terjual</dt>
              <dd>{stats.today_quantity || summary.quantity_sold}</dd>
            </div>
            <div className="dash-metrics__item">
              <dt>Rata-rata / struk</dt>
              <dd>{formatRupiah(stats.today_average || 0)}</dd>
            </div>
            <div className="dash-metrics__item">
              <dt>Belum bayar</dt>
              <dd>{stats.unpaid_orders}</dd>
            </div>
            <div className="dash-metrics__item">
              <dt>Bukti menunggu</dt>
              <dd>{stats.pending_proofs}</dd>
            </div>
          </>
        )}
      </dl>

      <section className="dash-chart" aria-label="Revenue 7 hari">
        <h2 className="dash-panel__title">Revenue 7 Hari</h2>
        {week.loading ? (
          <p className="chart-empty">Memuat grafik&hellip;</p>
        ) : week.error ? (
          <p className="chart-empty">Gagal memuat grafik: {week.error}</p>
        ) : (
          <RevenueTrendChart series={series} />
        )}
      </section>

      <div className="dash-two-col">
        <section className="dash-panel" aria-label="Status pesanan hari ini">
          <h2 className="dash-panel__title">Status Pesanan</h2>
          {day.loading ? (
            <p className="chart-empty">Memuat&hellip;</p>
          ) : day.error ? (
            <p className="chart-empty">Gagal memuat data.</p>
          ) : (
            <StatusBreakdown counts={statusCounts} />
          )}
        </section>

        <section className="dash-panel" aria-label="Pesanan terbaru">
          <div className="dash-panel__head">
            <h2 className="dash-panel__title">Pesanan Terbaru</h2>
            <Link to="/admin/orders" className="dash-panel__link">
              Lihat semua
            </Link>
          </div>
          {recentLoading ? (
            <p className="chart-empty">Memuat&hellip;</p>
          ) : recentOrders.length === 0 ? (
            <p className="chart-empty chart-empty--compact">Belum ada pesanan.</p>
          ) : (
            <table className="dash-recent">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Meja</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="dash-recent__number" data-label="Order">{order.order_number}</td>
                    <td data-label="Meja">{order.table?.table_number || 'Walk-in'}</td>
                    <td className="dash-recent__total" data-label="Total">{formatRupiah(order.total_price)}</td>
                    <td data-label="Status">
                      <span className={`staff-badge staff-badge--${order.status}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <LowStockSection />
    </div>
  )
}
