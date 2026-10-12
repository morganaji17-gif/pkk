import { useCallback, useEffect, useRef, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import { getStockMutations, peekStockMutationsCache } from '../../../api/client'
import { formatDateTime } from '../../../utils/format'

const REASON_LABELS = {
  checkout: 'Checkout',
  append: 'Tambah item',
  cancel: 'Pembatalan',
  product_create: 'Produk baru',
  product_update: 'Perbarui stok',
  manual: 'Penyesuaian manual',
  order_create: 'Pesanan dibuat',
}

function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason || '-'
}

export default function StockHistoryPage() {
  const initialCache = peekStockMutationsCache({ page: 1, per_page: 15 })
  const [mutations, setMutations] = useState(initialCache?.data || [])
  const [meta, setMeta] = useState(initialCache?.meta || {})
  const [loading, setLoading] = useState(!initialCache)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const inFlight = useRef(false)

  const load = useCallback(async (nextPage, q) => {
    if (inFlight.current) return
    inFlight.current = true
    if (nextPage === 1) setLoading(true)
    try {
      const result = await getStockMutations({ page: nextPage, per_page: 15, search: q })
      if (nextPage === 1) {
        setMutations(result.data)
      } else {
        setMutations((prev) => [...prev, ...result.data])
      }
      setMeta(result.meta)
      setError(null)
    } catch (err) {
      if (nextPage === 1) setError(err.message)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(1, search.trim()), 0)
    return () => clearTimeout(timer)
  }, [search, load])

  const loadMore = () => {
    if (!meta?.has_more) return
    setLoadingMore(true)
    load(page + 1, search.trim())
      .then(() => setPage((p) => p + 1))
      .finally(() => setLoadingMore(false))
  }

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Riwayat Stok"
        subtitle="Perubahan stok produk beserta alasan setiap mutasi."
      />

      <div className="staff-toolbar">
        <label className="report-field order-filters__search">
          <span className="report-field__label">Cari</span>
          <input
            type="search"
            className="field__input"
            placeholder="Cari produk…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </label>
      </div>

      {loading && <SkeletonTable rows={8} cols={5} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat riwayat stok" message={error} onRetry={() => load(1, search)} />
      )}

      {!loading && !error && (
        <>
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Produk</th>
                  <th>Perubahan</th>
                  <th>Stok</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {mutations.length === 0 && (
                  <tr>
                    <td colSpan="5" className="staff-table__empty">
                      Belum ada mutasi stok.
                    </td>
                  </tr>
                )}
                {mutations.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Waktu">{formatDateTime(m.created_at)}</td>
                    <td data-label="Produk">{m.product?.name || '-'}</td>
                    <td data-label="Perubahan">
                      <span className={`staff-badge ${m.delta > 0 ? 'staff-badge--success' : ''}`}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                    </td>
                    <td data-label="Stok">
                      {m.stock_before} → {m.stock_after}
                    </td>
                    <td data-label="Alasan">{reasonLabel(m.reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta?.has_more && (
            <div className="staff-loadmore">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Memuat…' : 'Muat Lebih Banyak'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}