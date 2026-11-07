import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import RevenueTrendChart from '../../components/charts/RevenueTrendChart'
import StatusBreakdown from '../../components/charts/StatusBreakdown'
import LowStockSection from '../../components/LowStockSection'
import PendingProofPayments from '../../components/PendingProofPayments'
import TopProductsSection from '../../components/TopProductsSection'
import { useDashboardStats } from '../../context/DashboardStatsContext'
import { useDayReport, useWeeklyReport } from '../../hooks/useReports'
import { formatRupiah } from '../../../utils/format'
import { prefetchIdle } from '../../../prefetch/prefetch'

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const QUICK_LINKS = [
  { to: '/admin/orders', label: 'Pesanan' },
  { to: '/admin/products', label: 'Menu' },
  { to: '/admin/tables', label: 'Meja & QR' },
  { to: '/admin/reports/sales', label: 'Laporan' },
  { to: '/admin/staff', label: 'Staf' },
]

function buildDailySeries(report) {
  if (!report?.from || !Array.isArray(report.orders)) return []
  const start = new Date(report.from)
  const buckets = []
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    buckets.push({ key: new Date(d).toISOString().slice(0, 10), label: DAY_LABELS[d.getDay()], value: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const order of report.orders) {
    if (order.payment_status !== 'paid') continue
    const bucket = byKey.get(new Date(order.created_at).toISOString().slice(0, 10))
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

export default function AdminDashboard() {
  const stats = useDashboardStats()
  const day = useDayReport()
  const week = useWeeklyReport()

  useEffect(() => {
    prefetchIdle('/admin')
  }, [])

  const series = useMemo(() => buildDailySeries(week.report), [week.report])
  const statusCounts = useMemo(() => countStatuses(day.report), [day.report])
  const summary = day.report?.summary

  const totalRevenue = Number(stats.today_revenue ?? summary?.total_revenue ?? 0)
  const totalTransactions = Number(stats.today_transactions ?? summary?.total_transactions ?? 0)
  const avgPerReceipt = totalTransactions > 0
    ? Math.round(totalRevenue / totalTransactions)
    : Number(stats.today_average) || 0
  const revenueLoading = day.loading && !summary && !stats.today_revenue

  const yesterday = Number(stats.yesterday_revenue) || 0
  const trendDelta = totalRevenue - yesterday
  const trendPercent = yesterday > 0 ? Math.round((trendDelta / yesterday) * 100) : totalRevenue > 0 ? 100 : 0

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  const heroStats = [
    { label: 'Menunggu', value: stats.pending_orders || 0, tone: stats.pending_orders > 0 ? 'warn' : '' },
    { label: 'Belum bayar', value: stats.unpaid_orders || 0, tone: stats.unpaid_orders > 0 ? 'warn' : '' },
    { label: 'Bukti QRIS', value: stats.pending_proofs || 0, tone: stats.pending_proofs > 0 ? 'danger' : '' },
    { label: 'Stok kritis', value: stats.low_stock_count || 0, tone: stats.low_stock_count > 0 ? 'danger' : '' },
  ]

  const hasProofs = (stats.pending_proofs || 0) > 0
  const hasTopProducts = (stats.today_top_products || []).length > 0

  return (
    <div className="ed-dash">
      <header className="ed-head">
        <div className="ed-head__left">
          <p className="ed-eyebrow">Ringkasan Operasional</p>
          <h1 className="ed-head__title">Dashboard</h1>
        </div>
        <div className="ed-head__meta">
          <span className="ed-head__date">{todayLabel}</span>
          <span className="ed-head__clock">{timeStr}</span>
        </div>
      </header>

      <section className="ed-hero" aria-label="Ringkasan pendapatan hari ini">
        <div className="ed-hero__main">
          <span className="ed-label">Pendapatan hari ini</span>
          <p className="ed-hero__amount">
            {revenueLoading ? <span className="ed-shimmer" /> : formatRupiah(totalRevenue)}
          </p>
          <div className="ed-hero__meta">
            {revenueLoading ? (
              <span className="ed-shimmer ed-shimmer--sm" />
            ) : (
              <>
                <span><strong>{totalTransactions}</strong> transaksi</span>
                <span className="ed-rule" aria-hidden="true" />
                <span><strong>{formatRupiah(avgPerReceipt)}</strong> / struk</span>
                {yesterday > 0 && (
                  <>
                    <span className="ed-rule" aria-hidden="true" />
                    <span className={`ed-trend ${trendDelta >= 0 ? 'ed-trend--up' : 'ed-trend--down'}`}>
                      {trendDelta >= 0 ? '▲' : '▼'} {Math.abs(trendPercent)}% vs kemarin
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="ed-hero__stats">
          {heroStats.map((item) => (
            <div key={item.label} className={`ed-stat${item.tone ? ` ed-stat--${item.tone}` : ''}`}>
              <span className="ed-stat__value">{item.value}</span>
              <span className="ed-stat__label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <nav className="ed-shortcuts" aria-label="Aksi cepat">
        {QUICK_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="ed-shortcut">
            {link.label}
            <span className="ed-shortcut__arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>

      <div className="ed-grid">
        <section className="ed-panel ed-panel--chart" aria-label="Pendapatan tujuh hari">
          <div className="ed-panel__head">
            <h2 className="ed-panel__title">Pendapatan 7 Hari</h2>
            <span className="ed-panel__note">Lunas</span>
          </div>
          <div className="ed-panel__body">
            {week.loading ? (
              <div className="ed-chart-skel"><span className="ed-shimmer" /></div>
            ) : week.error ? (
              <p className="chart-empty">Gagal memuat: {week.error}</p>
            ) : (
              <RevenueTrendChart series={series} />
            )}
          </div>
        </section>

        <section className="ed-panel ed-panel--status" aria-label="Status pesanan hari ini">
          <div className="ed-panel__head">
            <h2 className="ed-panel__title">Status Pesanan</h2>
            <span className="ed-panel__note">Hari ini</span>
          </div>
          <div className="ed-panel__body">
            {day.loading ? (
              <div className="ed-chart-skel ed-chart-skel--short"><span className="ed-shimmer" /></div>
            ) : day.error ? (
              <p className="chart-empty">Gagal memuat.</p>
            ) : (
              <StatusBreakdown counts={statusCounts} />
            )}
          </div>
        </section>

        {hasProofs && (
          <section
            className={`ed-panel ed-panel--proof${!hasTopProducts ? ' ed-panel--full' : ''}`}
            aria-label="Bukti pembayaran menunggu"
          >
            <div className="ed-panel__head">
              <h2 className="ed-panel__title">Bukti QRIS Menunggu</h2>
              <span className="ed-count">{stats.pending_proofs}</span>
            </div>
            <div className="ed-panel__body">
              <PendingProofPayments />
            </div>
          </section>
        )}

        {hasTopProducts && (
          <section
            className={`ed-panel ed-panel--top${!hasProofs ? ' ed-panel--full' : ''}`}
            aria-label="Produk terlaris hari ini"
          >
            <div className="ed-panel__head">
              <h2 className="ed-panel__title">Produk Terlaris</h2>
              <span className="ed-panel__note">Hari ini</span>
            </div>
            <div className="ed-panel__body">
              <TopProductsSection />
            </div>
          </section>
        )}
      </div>

      <div className="ed-low">
        <LowStockSection />
      </div>
    </div>
  )
}
