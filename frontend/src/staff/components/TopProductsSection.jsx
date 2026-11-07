import { formatRupiah } from '../../utils/format'
import { useDashboardStats } from '../context/DashboardStatsContext'

/** Daftar produk terlaris hari ini (dari dashboard stats). */
export default function TopProductsSection() {
  const stats = useDashboardStats()
  const items = stats.today_top_products || []

  if (items.length === 0) {
    return <p className="chart-empty chart-empty--compact">Belum ada penjualan hari ini.</p>
  }

  return (
    <ol className="top-products__list" aria-label="Produk terlaris hari ini">
      {items.map((row, index) => (
        <li key={row.product_id} className="top-products__item">
          <span className="top-products__rank">{String(index + 1).padStart(2, '0')}</span>
          <span className="top-products__name">{row.name}</span>
          <span className="top-products__meta">
            <strong>{row.quantity}×</strong>
            <span className="top-products__revenue">{formatRupiah(row.revenue)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
