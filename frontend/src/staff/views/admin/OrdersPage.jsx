import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { prefetchIdle } from '../../../prefetch/prefetch'
import PageHeader from '../../components/PageHeader'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import OrdersTable from '../../components/OrdersTable'
import OrderDetail from '../../components/OrderDetail'
import Modal from '../../components/Modal'
import OrderFilters from '../../components/OrderFilters'
import { useOrders } from '../../hooks/useOrders'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'

export default function OrdersPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({})
  const { orders, meta, loading, loadingMore, error, refresh, refreshQuiet, loadMore } = useOrders(filters)
  const [selected, setSelected] = useState(null)

  const openDetail = (order) => {
    navigate(`/admin/orders/${order.id}`)
  }

  const hasFilters = Boolean(filters.search || filters.status || filters.payment_status)

  useEffect(() => {
    prefetchIdle('/admin/orders')
  }, [])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel === 'orders') refreshQuiet()
    },
  })

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Pesanan"
        subtitle="Lihat semua pesanan. Klik baris untuk buka detail dan proses status/pembayaran."
        actions={
          <button type="button" className="btn btn--secondary" onClick={refresh}>
            Refresh
          </button>
        }
      />

      <OrderFilters value={filters} onChange={setFilters} disabled={loading} />

      {loading && <SkeletonTable rows={6} cols={6} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat pesanan" message={error} onRetry={refresh} />
      )}

      {!loading && !error && (
        <>
          <OrdersTable
            orders={orders}
            onSelect={openDetail}
            emptyLabel={
              hasFilters
                ? 'Tidak ada pesanan yang cocok dengan filter.'
                : undefined
            }
          />
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

      <Modal
        open={Boolean(selected)}
        title={`Detail Order ${selected?.order_number || ''}`}
        onClose={() => setSelected(null)}
      >
        {selected && <OrderDetail order={selected} />}
      </Modal>
    </div>
  )
}
