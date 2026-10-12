import { useEffect, useState } from 'react'
import { getSalesReport } from '../../api/client'
import ErrorState from '../../components/ErrorState'
import { SkeletonCards } from '../../components/Skeleton'
import { formatRupiah, localDateStr } from '../../utils/format'

export default function TodaySummary() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (document.hidden) return
      try {
        const data = await getSalesReport('day', localDateStr())
        if (cancelled) return
        setSummary(data.summary)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 120000)
    const onVisibility = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reloadKey])

  if (loading) {
    return (
      <section className="today-summary">
        <div className="today-summary__head">
          <h2 className="today-summary__title">Ringkasan Hari Ini</h2>
        </div>
        <SkeletonCards count={7} />
      </section>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Gagal memuat ringkasan"
        message={error}
        onRetry={() => setReloadKey((n) => n + 1)}
      />
    )
  }

  if (!summary) return null

  const cards = [
    { label: 'Transaksi Hari Ini', value: summary.total_transactions },
    { label: 'Pendapatan (Lunas)', value: formatRupiah(summary.total_revenue) },
    { label: 'Cash', value: formatRupiah(summary.cash) },
    { label: 'QRIS', value: formatRupiah(summary.qris) },
    { label: 'Transaksi Lunas', value: summary.paid },
    { label: 'Belum Dibayar', value: summary.unpaid },
    { label: 'Produk Terjual', value: summary.quantity_sold },
  ]

  return (
    <section className="today-summary">
      <div className="today-summary__head">
        <h2 className="today-summary__title">Ringkasan Hari Ini</h2>
      </div>
      <div className="today-summary__cards">
        {cards.map((card) => (
          <div key={card.label} className="report-card">
            <span className="report-card__label">{card.label}</span>
            <span className="report-card__value">{card.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}