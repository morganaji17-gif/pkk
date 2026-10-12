import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../auth/useAuth'
import { useDashboardStats } from '../../context/DashboardStatsContext'
import { prefetchIdle } from '../../../prefetch/prefetch'
import PageHeader from '../../components/PageHeader'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import { useOrders } from '../../hooks/useOrders'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import { updateOrderStatus } from '../../../api/client'
import { formatDateTime, getOrderItems } from '../../../utils/format'
import { toastSuccess } from '../../../utils/swal'

const COLUMNS = [
  { status: 'confirmed', title: 'NEW', hint: 'Siap mulai dikerjakan' },
  { status: 'preparing', title: 'PREPARING', hint: 'Sedang disiapkan' },
  { status: 'served', title: 'READY', hint: 'Siap disajikan' },
]

const NEXT_ACTION = {
  confirmed: { next: 'preparing', label: 'Mulai Proses' },
  preparing: { next: 'served', label: 'Tandai Siap' },
  served: { next: 'completed', label: 'Selesaikan' },
}

function KdsCard({ order, busy, onAction }) {
  const items = getOrderItems(order)
  const action = NEXT_ACTION[order.status]

  return (
    <article className="kds-card">
      <header className="kds-card__head">
        <strong className="kds-card__number">{order.order_number}</strong>
        <span className="kds-card__table">Meja {order.table?.table_number || '-'}</span>
      </header>
      <p className="kds-card__time">{formatDateTime(order.created_at)}</p>
      {order.customer_name && (
        <p className="kds-card__customer">{order.customer_name}</p>
      )}
      <ul className="kds-card__items">
        {items.map((item) => (
          <li key={item.id}>
            <span>
              {item.product?.name || 'Produk'} <strong>× {item.quantity}</strong>
            </span>
            {item.notes && <small>Catatan: {item.notes}</small>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="kds-card__note">Catatan order: {order.notes}</p>}
      {action && (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy}
          onClick={() => onAction(order, action.next)}
        >
          {busy ? 'Memproses…' : action.label}
        </button>
      )}
    </article>
  )
}

export default function KitchenDashboard() {
  const { user } = useAuth()
  const stats = useDashboardStats()
  const { orders, loading, error, refresh, refreshQuiet, updateLocal } = useOrders({})
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    prefetchIdle('/kitchen')
  }, [])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel !== 'orders' && event?.channel !== 'dashboard') return
      // Senyap: tanpa skeleton, paksa ambil data segar (bypass cache).
      refreshQuiet()
      if (event?.channel === 'orders' && event.payload?.type === 'order.created') {
        toastSuccess(`Pesanan baru masuk: ${event.payload.order_number || ''}`.trim())
      }
    },
  })

  const grouped = useMemo(() => {
    const map = { confirmed: [], preparing: [], served: [] }
    for (const order of orders) {
      if (order.status in map) map[order.status].push(order)
    }
    return map
  }, [orders])

  const handleAction = async (order, next) => {
    if (busyId) return
    setBusyId(order.id)
    setActionError(null)
    try {
      const updated = await updateOrderStatus(order.id, next)
      // Optimistis: kartu langsung pindah kolom tanpa menunggu refetch.
      updateLocal(order.id, {
        status: updated?.status || next,
        updated_at: updated?.updated_at,
      })
      toastSuccess(`${order.order_number} → ${next}`)
      // Konfirmasi senyap di background (cache sudah diinvalidasi mutasi).
      refreshQuiet()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="staff-dashboard">
      <PageHeader
        title={`Dapur — Halo, ${user?.name}`}
        subtitle="Kasir terima pesanan, dapur masak. Tanpa refresh manual."
        actions={
          <button type="button" className="btn btn--secondary" onClick={refresh}>
            Refresh
          </button>
        }
      />

      {stats.pending_orders > 0 && (
        <p className="alert alert--info">
          {stats.pending_orders} pesanan masih menunggu kasir — belum masuk antrean dapur.
        </p>
      )}

      {actionError && <div className="alert alert--error">{actionError}</div>}

      {loading && <SkeletonTable rows={6} cols={3} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat dapur" message={error} onRetry={refresh} />
      )}

      {!loading && !error && (
        <div className="kds-board">
          {COLUMNS.map((col) => (
            <section key={col.status} className="kds-column" aria-label={col.title}>
              <header className="kds-column__head">
                <h2 className="kds-column__title">{col.title}</h2>
                <span className="kds-column__count">{grouped[col.status].length}</span>
              </header>
              <p className="kds-column__hint">{col.hint}</p>
              <div className="kds-column__list">
                {grouped[col.status].length === 0 ? (
                  <p className="chart-empty chart-empty--compact">Kosong.</p>
                ) : (
                  grouped[col.status].map((order) => (
                    <KdsCard
                      key={order.id}
                      order={order}
                      busy={busyId === order.id}
                      onAction={handleAction}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
