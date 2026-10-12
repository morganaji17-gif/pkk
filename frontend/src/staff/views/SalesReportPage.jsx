/* eslint-disable react-hooks/set-state-in-effect -- SWR */
import { useEffect, useState } from 'react'
import { prefetchIdle } from '../../prefetch/prefetch'
import PageHeader from '../components/PageHeader'
import ErrorState from '../../components/ErrorState'
import { SkeletonCards, SkeletonTable } from '../../components/Skeleton'
import { getSalesReport, getSalesReportPdf, getSalesReportCsv, peekSalesCache } from '../../api/client'
import { formatRupiah, formatDateTime, localDateStr } from '../../utils/format'

const PERIODS = [
  { value: 'day', label: 'Harian' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
]

function methodLabel(method) {
  if (method === 'qris') return 'QRIS'
  if (method === 'cash') return 'Cash'
  return '-'
}

export default function SalesReportPage() {
  const [period, setPeriod] = useState('day')
  const [date, setDate] = useState(localDateStr())
  const initialReport = peekSalesCache('day', localDateStr())
  const [report, setReport] = useState(initialReport)
  const [loading, setLoading] = useState(!initialReport)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(null)

  const load = async (p, d) => {
    const cached = peekSalesCache(p, d)
    if (cached) {
      setReport(cached)
      setError(null)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await getSalesReport(p, d)
      setReport(data)
      setError(null)
    } catch (err) {
      if (!cached) {
        setReport(null)
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const cached = peekSalesCache('day', localDateStr())
    if (cached) {
      setReport(cached)
      setError(null)
    }
    getSalesReport('day', localDateStr())
      .then((data) => {
        if (cancelled) return
        setReport(data)
      })
      .catch((err) => {
        if (cancelled) return
        if (!cached) {
          setError(err.message)
          setReport(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    prefetchIdle('/admin/reports/sales')
  }, [])

  const downloadPdf = async () => {
    setDownloading(true)
    setError(null)
    try {
      const blob = await getSalesReportPdf(period, date)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-penjualan-${date}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  const downloadCsv = async () => {
    setDownloading(true)
    setError(null)
    try {
      const blob = await getSalesReportCsv(period, date)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-penjualan-${date}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Laporan Penjualan"
        subtitle="Lihat ringkasan penjualan dan unduh laporan dalam format PDF atau CSV."
        actions={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={downloadCsv}
              disabled={downloading || loading || !report}
            >
              {downloading ? 'Menyiapkan…' : 'Unduh CSV'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={downloadPdf}
              disabled={downloading || loading || !report}
            >
              {downloading ? 'Menyiapkan PDF…' : 'Unduh PDF'}
            </button>
          </>
        }
      />

      <div className="report-toolbar">
        <label className="report-field">
          <span className="report-field__label">Periode</span>
          <select
            className="field__input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="report-field">
          <span className="report-field__label">Tanggal</span>
          <input
            type="date"
            className="field__input"
            value={date}
            max={localDateStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => load(period, date)}
          disabled={loading}
        >
          {loading ? 'Memuat…' : 'Muat Laporan'}
        </button>
      </div>

      {loading && (
        <div className="report-loading">
          <SkeletonCards count={7} />
          <SkeletonTable rows={6} cols={6} />
        </div>
      )}

      {error && !loading && (
        <ErrorState
          title="Gagal memuat laporan"
          message={error}
          onRetry={() => load(period, date)}
        />
      )}

      {!loading && !error && report && (
        <>
          <div className="report-summary">
            <div className="report-card">
              <span className="report-card__label">Total Transaksi</span>
              <span className="report-card__value">{report.summary.total_transactions}</span>
            </div>
            <div className="report-card report-card--primary">
              <span className="report-card__label">Pendapatan (Lunas)</span>
              <span className="report-card__value">{formatRupiah(report.summary.total_revenue)}</span>
            </div>
            <div className="report-card">
              <span className="report-card__label">Service Charge</span>
              <span className="report-card__value">{formatRupiah(report.summary.service_charge || 0)}</span>
            </div>
            <div className="report-card">
              <span className="report-card__label">PPN</span>
              <span className="report-card__value">{formatRupiah(report.summary.tax || 0)}</span>
            </div>
            <div className="report-card">
              <span className="report-card__label">Profit (Pendapatan − HPP)</span>
              <span className="report-card__value">{formatRupiah(report.summary.profit || 0)}</span>
            </div>
            <div className="report-card">
              <span className="report-card__label">Cash</span>
              <span className="report-card__value">{formatRupiah(report.summary.cash)}</span>
            </div>
            <div className="report-card">
              <span className="report-card__label">QRIS</span>
              <span className="report-card__value">{formatRupiah(report.summary.qris)}</span>
            </div>
            <div className="report-card">
              <span className="report-card__label">Transaksi Lunas</span>
              <span className="report-card__value">{report.summary.paid}</span>
            </div>
            <div className="report-card">
              <span className="report-card__label">Belum Dibayar</span>
              <span className="report-card__value">{report.summary.unpaid}</span>
            </div>
            <div className="report-card">
              <span className="report-card__label">Produk Terjual</span>
              <span className="report-card__value">{report.summary.quantity_sold}</span>
            </div>
          </div>

          <p className="report-period">Periode: {report.label}</p>

          {report.comparison && (
            <div className="report-compare">
              <span className="report-compare__title">Perbandingan dengan Periode Sebelumnya</span>
              <div className="report-compare__grid">
                <div className="report-compare__item">
                  <span className="report-compare__label">Transaksi</span>
                  <strong className="report-compare__value">
                    {report.comparison.total_transactions ?? '-'}
                    {report.comparison.transactions_change !== null && (
                      <span className="report-compare__delta">
                        {' '}
                        ({report.comparison.transactions_change > 0 ? '+' : ''}
                        {report.comparison.transactions_change}%)
                      </span>
                    )}
                  </strong>
                </div>
                <div className="report-compare__item">
                  <span className="report-compare__label">Pendapatan</span>
                  <strong className="report-compare__value">
                    {formatRupiah(report.comparison.total_revenue || 0)}
                    {report.comparison.revenue_change !== null && (
                      <span className="report-compare__delta">
                        {' '}
                        ({report.comparison.revenue_change > 0 ? '+' : ''}
                        {report.comparison.revenue_change}%)
                      </span>
                    )}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {(report.top_products?.length > 0 || report.category_breakdown?.length > 0) && (
            <div className="report-extra">
              {report.top_products?.length > 0 && (
                <section className="report-extra__block">
                  <h3 className="report-extra__title">Produk Terlaris</h3>
                  <div className="staff-table-wrap">
                    <table className="staff-table">
                      <thead>
                        <tr>
                          <th>Produk</th>
                          <th>Terjual</th>
                          <th className="staff-table__total">Pendapatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.top_products.map((item) => (
                          <tr key={item.product_id}>
                            <td data-label="Produk">{item.product_name}</td>
                            <td data-label="Terjual">{item.quantity}</td>
                            <td className="staff-table__total" data-label="Pendapatan">{formatRupiah(item.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {report.category_breakdown?.length > 0 && (
                <section className="report-extra__block">
                  <h3 className="report-extra__title">Rincian Kategori</h3>
                  <div className="staff-table-wrap">
                    <table className="staff-table">
                      <thead>
                        <tr>
                          <th>Kategori</th>
                          <th>Terjual</th>
                          <th className="staff-table__total">Pendapatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.category_breakdown.map((item) => (
                          <tr key={item.category_id}>
                            <td data-label="Kategori">{item.category_name}</td>
                            <td data-label="Terjual">{item.quantity}</td>
                            <td className="staff-table__total" data-label="Pendapatan">{formatRupiah(item.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}

          {report.orders.length === 0 ? (
            <div className="staff-empty">Tidak ada transaksi pada periode ini.</div>
          ) : (
            <div className="staff-table-wrap">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>No. Order</th>
                    <th>Tanggal</th>
                    <th>Customer</th>
                    <th>Meja</th>
                    <th>Metode</th>
                    <th>Status</th>
                    <th className="staff-table__total">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orders.map((order) => (
                    <tr key={order.id}>
                      <td className="staff-table__number" data-label="No. Order">{order.order_number}</td>
                      <td className="staff-table__muted" data-label="Tanggal">{formatDateTime(order.created_at)}</td>
                      <td data-label="Customer">{order.customer_name}</td>
                      <td className="staff-table__muted" data-label="Meja">Meja {order.table_number || '-'}</td>
                      <td data-label="Metode">{methodLabel(order.payment_method)}</td>
                      <td data-label="Status">
                        <span
                          className={`staff-badge ${
                            order.payment_status === 'paid'
                              ? 'staff-badge--completed'
                              : 'staff-badge--pending'
                          }`}
                        >
                          {order.payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar'}
                        </span>
                      </td>
                      <td className="staff-table__total" data-label="Total">{formatRupiah(order.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}