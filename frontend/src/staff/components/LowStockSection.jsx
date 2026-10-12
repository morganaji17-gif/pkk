/* eslint-disable react-hooks/set-state-in-effect -- kondisi awal tanpa fetch */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProducts } from '../../api/client'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import { stockStatusLabel, stockStatusClass } from '../../utils/stock'
import { useDashboardStats } from '../context/DashboardStatsContext'

export default function LowStockSection() {
  const stats = useDashboardStats()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (stats.low_stock_count === 0) {
      setItems([])
      setLoading(false)
      return
    }
    let cancelled = false
    getProducts({ per_page: 50 })
      .then((res) => {
        if (cancelled) return
        const data = Array.isArray(res) ? res : res.items || []
        const low = data
          .filter((product) => product.is_active && product.stock_status !== 'normal')
          .sort((a, b) => Number(a.stock) - Number(b.stock))
        setItems(low)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, stats.low_stock_count])

  if (loading) {
    return <LoadingState label="Memuat stok…" />
  }

  if (error) {
    return (
      <ErrorState
        title="Gagal memuat stok"
        message={error}
        onRetry={() => setReloadKey((n) => n + 1)}
      />
    )
  }

  if (items.length === 0) return null

  return (
    <section className="low-stock">
      <div className="low-stock__head">
        <h2 className="low-stock__title">Stok Perlu Perhatian</h2>
        <Link to="/admin/products" className="btn btn--secondary">
          Kelola Produk
        </Link>
      </div>
      <ul className="low-stock__list">
        {items.map((product) => (
          <li key={product.id} className="low-stock__item">
            <span className="low-stock__name">{product.name}</span>
            <span className="low-stock__meta">
              <span
                className={`staff-badge stock-badge ${stockStatusClass(product.stock_status)}`}
              >
                {stockStatusLabel(product.stock_status)}
              </span>
              <span className="low-stock__qty">Sisa {product.stock}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}