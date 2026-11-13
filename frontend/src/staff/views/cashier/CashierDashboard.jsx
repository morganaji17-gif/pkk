import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/useAuth'
import { prefetchIdle } from '../../../prefetch/prefetch'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import OrderFilters from '../../components/OrderFilters'
import { useOrders } from '../../hooks/useOrders'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import { toastError, toastSuccess } from '../../../utils/swal'
import { confirmAction } from '../../../utils/swal'
import { formatDateTime, formatRupiah } from '../../../utils/format'
import {
  clearRestaurantTable,
  getRestaurantTables,
  updateOrderStatus,
  updateRestaurantTableStatus,
} from '../../../api/client'

const STATUS_LABELS = {
  pending: 'Menunggu',
  confirmed: 'Diterima',
  preparing: 'Disiapkan',
  served: 'Siap',
  completed: 'Selesai',
  cancelled: 'Batal',
}

const TABLE_LEGEND = [
  { status: 'available', label: 'Kosong' },
  { status: 'occupied', label: 'Terisi' },
  { status: 'maintenance', label: 'Maintenance' },
]

function tableStatus(table) {
  if (table.status === 'maintenance') return 'maintenance'
  if (Number(table.active_orders_count) > 0) return 'occupied'
  return 'available'
}

function StatTile({ label, value, tone, hint }) {
  return (
    <div className={`cashier-tile cashier-tile--${tone}`}>
      <div className="cashier-tile__body">
        <span className="cashier-tile__label">{label}</span>
        <strong className="cashier-tile__value">{value}</strong>
        {hint && <span className="cashier-tile__hint">{hint}</span>}
      </div>
    </div>
  )
}

function PendingQueue({ orders, busyId, onAccept, onSelect }) {
  if (orders.length === 0) return null
  return (
    <section className="cashier-queue" aria-label="Antrean menunggu konfirmasi">
      <header className="cashier-queue__head">
        <div className="cashier-queue__title">
          <span className="cashier-queue__pulse" aria-hidden="true" />
          Perlu Dikonfirmasi
          <span className="cashier-queue__count">{orders.length}</span>
        </div>
        <span className="cashier-queue__hint">Terima agar masuk antrean dapur</span>
      </header>
      <ul className="cashier-queue__list">
        {orders.map((order) => (
          <li key={order.id} className="cashier-queue__item">
            <button
              type="button"
              className="cashier-queue__info"
              onClick={() => onSelect(order)}
            >
              <span className="cashier-queue__number">{order.order_number}</span>
              <span className="cashier-queue__meta">
                {order.customer_name} · Meja {order.table?.table_number ?? '-'} ·{' '}
                {formatDateTime(order.created_at)}
              </span>
            </button>
            <span className="cashier-queue__price">{formatRupiah(order.total_price)}</span>
            <button
              type="button"
              className="btn btn--primary btn--sm cashier-queue__accept"
              disabled={busyId === order.id}
              onClick={() => onAccept(order)}
            >
              {busyId === order.id ? '…' : 'Terima'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OrderRow({ order, onSelect }) {
  const table = order.table?.table_number ?? '-'
  const itemCount = Array.isArray(order.order_items) ? order.order_items.length : 0
  return (
    <li className={`cashier-row cashier-row--${order.status}`}>
      <button type="button" className="cashier-row__hit" onClick={() => onSelect(order)}>
        <span className="cashier-row__stripe" aria-hidden="true" />
        <span className="cashier-row__main">
          <span className="cashier-row__top">
            <strong className="cashier-row__number">{order.order_number}</strong>
            <span className={`cashier-status-pill cashier-status-pill--${order.status}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </span>
          <span className="cashier-row__meta">
            <span>{order.customer_name}</span>
            <span className="cashier-row__dot">·</span>
            <span className="cashier-row__table">Meja {table}</span>
            <span className="cashier-row__dot">·</span>
            <span>{itemCount} item</span>
            <span className="cashier-row__dot">·</span>
            <span>{formatDateTime(order.created_at)}</span>
          </span>
        </span>
        <span className="cashier-row__side">
          <span className="cashier-row__price">{formatRupiah(order.total_price)}</span>
          <span
            className={`cashier-pay-badge cashier-pay-badge--${order.payment_status}`}
          >
            {order.payment_status === 'paid' ? 'Lunas' : 'Belum bayar'}
          </span>
        </span>
      </button>
    </li>
  )
}

function TableGrid({ tables, loading, onAction }) {
  if (loading) return <p className="chart-empty chart-empty--compact">Memuat meja…</p>
  if (!tables || tables.length === 0) {
    return <p className="chart-empty chart-empty--compact">Belum ada meja.</p>
  }
  return (
    <>
      <div className="cashier-tablegrid">
        {tables.map((table) => {
          const status = tableStatus(table)
          const count = Number(table.active_orders_count) || 0
          return (
            <button
              key={table.id}
              type="button"
              className={`cashier-tablecard cashier-tablecard--${status}`}
              onClick={() => onAction(table, status)}
              title={
                status === 'occupied'
                  ? `Meja ${table.table_number} — klik untuk kosongkan`
                  : status === 'maintenance'
                    ? `Meja ${table.table_number} — klik untuk mengaktifkan`
                    : `Meja ${table.table_number} — klik untuk maintenance`
              }
            >
              <span className="cashier-tablecard__number">{table.table_number}</span>
              <span className="cashier-tablecard__meta">
                {status === 'occupied'
                  ? `${count} aktif`
                  : status === 'maintenance'
                    ? 'Maintenance'
                    : 'Kosong'}
              </span>
              {status === 'occupied' && (
                <span className="cashier-tablecard__action">Kosongkan</span>
              )}
            </button>
          )
        })}
      </div>
      <div className="cashier-legend">
        {TABLE_LEGEND.map((item) => (
          <span key={item.status} className="cashier-legend__item">
            <span className={`cashier-legend__dot cashier-legend__dot--${item.status}`} />
            {item.label}
          </span>
        ))}
      </div>
    </>
  )
}

export default function CashierDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({})
  const [tables, setTables] = useState(null)
  const [tablesLoading, setTablesLoading] = useState(true)
  const [busyOrderId, setBusyOrderId] = useState(null)

  const { orders, meta, loading, loadingMore, error, refresh, refreshQuiet, loadMore } =
    useOrders(filters)

  const selectOrder = (order) => navigate(`/cashier/orders/${order.id}`)

  const hasFilters = Boolean(filters.search || filters.status || filters.payment_status)

  useEffect(() => {
    prefetchIdle('/cashier')
  }, [])

  const loadTables = () =>
    getRestaurantTables({ per_page: 50 })
      .then((res) => setTables(Array.isArray(res) ? res : res.items || []))
      .catch(() => {})

  useEffect(() => {
    let cancelled = false
    getRestaurantTables({ per_page: 50 })
      .then((res) => {
        if (!cancelled) setTables(Array.isArray(res) ? res : res.items || [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTablesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Realtime: pesanan + meja.
  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel === 'orders') {
        refreshQuiet()
        if (event.payload?.type === 'order.created') {
          toastSuccess(`Pesanan baru: ${event.payload.order_number || ''}`.trim())
        }
      }
      if (event?.channel === 'tables') {
        loadTables()
      }
    },
  })

  const handleAccept = async (order) => {
    if (busyOrderId) return
    setBusyOrderId(order.id)
    try {
      await updateOrderStatus(order.id, 'confirmed')
      toastSuccess(`${order.order_number} diterima — masuk antrean dapur`)
      refreshQuiet()
    } catch (err) {
      toastError(err.message || 'Gagal menerima pesanan')
    } finally {
      setBusyOrderId(null)
    }
  }

  const handleTableAction = async (table, status) => {
    // Meja terisi → tawarkan kosongkan (selesaikan semua pesanan aktif).
    if (status === 'occupied') {
      const count = Number(table.active_orders_count) || 0
      const confirmed = await confirmAction({
        title: `Kosongkan Meja ${table.table_number}?`,
        text:
          count > 0
            ? `${count} pesanan aktif akan ditandai selesai, lalu meja jadi kosong.`
            : 'Meja ini akan ditandai kosong.',
        confirmButtonText: 'Kosongkan',
      })
      if (!confirmed) return

      try {
        await clearRestaurantTable(table.id)
        toastSuccess(`Meja ${table.table_number} dikosongkan`)
        loadTables()
        refreshQuiet()
      } catch (err) {
        toastError(err.message || 'Gagal mengosongkan meja')
      }
      return
    }

    // Kosong ↔ maintenance.
    const next = status === 'maintenance' ? 'available' : 'maintenance'
    const prev = table.status
    setTables((current) =>
      (current || []).map((t) => (t.id === table.id ? { ...t, status: next } : t)),
    )
    try {
      await updateRestaurantTableStatus(table.id, next)
      toastSuccess(`Meja ${table.table_number} → ${next === 'maintenance' ? 'Maintenance' : 'Tersedia'}`)
    } catch (err) {
      // Rollback kalau gagal.
      setTables((current) =>
        (current || []).map((t) => (t.id === table.id ? { ...t, status: prev } : t)),
      )
      toastError(err.message || 'Gagal ubah status meja')
    }
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending')
  const activeOrders = orders.filter((o) =>
    ['confirmed', 'preparing', 'served'].includes(o.status),
  )
  const unpaidOrders = orders.filter(
    (o) => o.payment_status === 'unpaid' && o.status !== 'cancelled',
  )
  const revenue = orders
    .filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total_price), 0)
  const totalOrders = meta?.total ?? orders.length

  return (
    <div className="cashier-dash">
      <header className="cashier-hero">
        <div className="cashier-hero__text">
          <p className="cashier-hero__eyebrow">Panel Kasir</p>
          <h1 className="cashier-hero__title">Halo, {user?.name || 'Kasir'}</h1>
          <p className="cashier-hero__subtitle">
            Konfirmasi pesanan masuk, pantau meja, dan pantau pembayaran dari satu layar.
          </p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={refresh}>
          Refresh
        </button>
      </header>

      <div className="cashier-tiles">
        <StatTile
          label="Perlu Konfirmasi"
          value={loading ? '…' : pendingOrders.length}
          tone={pendingOrders.length > 0 ? 'warning' : 'muted'}
          hint={pendingOrders.length > 0 ? 'Segera terima' : 'Tidak ada antrean'}
        />
        <StatTile
          label="Sedang Diproses"
          value={loading ? '…' : activeOrders.length}
          tone="info"
          hint="Diterima / disiapkan / siap"
        />
        <StatTile
          label="Belum Bayar"
          value={loading ? '…' : unpaidOrders.length}
          tone={unpaidOrders.length > 0 ? 'danger' : 'muted'}
          hint="Perlu ditagih"
        />
        <StatTile
          label="Pendapatan Lunas"
          value={loading ? '…' : formatRupiah(revenue)}
          tone="success"
          hint={`${totalOrders} pesanan total`}
        />
      </div>

      <div className="cashier-grid">
        <main className="cashier-main">
          {!loading && !error && (
            <PendingQueue
              orders={pendingOrders}
              busyId={busyOrderId}
              onAccept={handleAccept}
              onSelect={selectOrder}
            />
          )}

          <div className="cashier-toolbar">
            <OrderFilters value={filters} onChange={setFilters} disabled={loading} />
          </div>

          {loading && <SkeletonTable rows={6} cols={5} />}

          {error && !loading && (
            <ErrorState title="Gagal memuat pesanan" message={error} onRetry={refresh} />
          )}

          {!loading && !error && (
            <>
              {orders.length === 0 ? (
                <div className="cashier-empty">
                  <p className="cashier-empty__text">
                    {hasFilters
                      ? 'Tidak ada pesanan yang cocok dengan filter.'
                      : 'Belum ada pesanan masuk.'}
                  </p>
                </div>
              ) : (
                <ul className="cashier-list">
                  {orders.map((order) => (
                    <OrderRow key={order.id} order={order} onSelect={selectOrder} />
                  ))}
                </ul>
              )}

              {meta?.has_more && (
                <div className="cashier-loadmore">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Memuat…' : 'Muat Lebih Banyak'}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <aside className="cashier-side">
          <section className="cashier-card">
            <header className="cashier-card__head">
              <h2 className="cashier-card__title">Status Meja</h2>
              <span className="cashier-card__hint">Klik untuk ubah</span>
            </header>
            <TableGrid tables={tables} loading={tablesLoading} onAction={handleTableAction} />
          </section>

          <section className="cashier-card">
            <header className="cashier-card__head">
              <h2 className="cashier-card__title">Ringkasan</h2>
            </header>
            <dl className="cashier-summary">
              <div className="cashier-summary__row">
                <dt>Total pesanan</dt>
                <dd>{loading ? '…' : totalOrders}</dd>
              </div>
              <div className="cashier-summary__row">
                <dt>Lunas</dt>
                <dd>{loading ? '…' : orders.filter((o) => o.payment_status === 'paid').length}</dd>
              </div>
              <div className="cashier-summary__row">
                <dt>Belum bayar</dt>
                <dd className="cashier-summary__warn">
                  {loading ? '…' : unpaidOrders.length}
                </dd>
              </div>
              <div className="cashier-summary__row cashier-summary__row--total">
                <dt>Pendapatan lunas</dt>
                <dd>{loading ? '…' : formatRupiah(revenue)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}
