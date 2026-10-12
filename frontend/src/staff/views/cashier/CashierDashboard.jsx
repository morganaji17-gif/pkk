import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/useAuth'
import { prefetchIdle } from '../../../prefetch/prefetch'
import PageHeader from '../../components/PageHeader'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import OrdersTable from '../../components/OrdersTable'
import TodaySummary from '../../components/TodaySummary'
import OrderFilters from '../../components/OrderFilters'
import TableStatusSection from '../../components/TableStatusSection'
import { useOrders } from '../../hooks/useOrders'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import { toastSuccess } from '../../../utils/swal'

export default function CashierDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({})
  const { orders, meta, loading, loadingMore, error, refresh, refreshQuiet, loadMore } = useOrders(filters)

  const selectOrder = (order) => {
    navigate(`/cashier/orders/${order.id}`)
  }

  const hasFilters = Boolean(filters.search || filters.status || filters.payment_status)

  useEffect(() => {
    prefetchIdle('/cashier')
  }, [])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel !== 'orders') return
      refreshQuiet()
      if (event.payload?.type === 'order.created') {
        toastSuccess(`Pesanan baru masuk: ${event.payload.order_number || ''}`.trim())
      }
    },
  })

  return (
    <div className="staff-dashboard">
      <PageHeader
        title={`Selamat datang, ${user?.name}`}
        subtitle="Panel kasir — terima pesanan, verifikasi pembayaran, selesaikan penyajian."
        actions={
          <button type="button" className="btn btn--secondary" onClick={refresh}>
            Refresh
          </button>
        }
      />

      <TodaySummary />

      <TableStatusSection />

      <OrderFilters value={filters} onChange={setFilters} disabled={loading} />

      {loading && <SkeletonTable rows={6} cols={6} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat pesanan" message={error} onRetry={refresh} />
      )}

      {!loading && !error && (
        <>
          <OrdersTable
            orders={orders}
            onSelect={selectOrder}
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
    </div>
  )
}
