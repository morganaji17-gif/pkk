import { formatRupiah } from '../../utils/format'
import { useDashboardStats } from '../context/DashboardStatsContext'

/** Panel produk terlaris hari ini (dari dashboard stats). */
export default function TopProductsSection() {
  const stats = useDashboardStats()
  const items = stats.today_top_products || []

  return (
    <section className="dash-panel" aria-label="Produk terlaris hari ini">
      <h2 className="dash-panel__title">Produk Terlaris Hari Ini</h2>
      {items.length === 0 ? (
        <p className="chart-empty chart-empty--compact">Belum ada penjualan hari ini.</p>
      ) : (
        <ol className="top-products__list">
          {items.map((row, index) => (
            <li key={row.product_id} className="top-products__item">
              <span className="top-products__rank">{index + 1}</span>
              <span className="top-products__name">{row.name}</span>
              <span className="top-products__meta">
                {row.quantity}x · {formatRupiah(row.revenue)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
