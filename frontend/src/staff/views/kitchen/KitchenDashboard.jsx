import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../auth/useAuth'
import { useDashboardStats } from '../../context/DashboardStatsContext'
import { prefetchIdle } from '../../../prefetch/prefetch'
import PageHeader from '../../components/PageHeader'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import { useOrders } from '../../hooks/useOrders'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import { updateOrderStatus } from '../../../api/client'
import { getOrderItems, parseSelectedOptions } from '../../../utils/format'
import { toastSuccess } from '../../../utils/swal'

const COLUMNS = [
  { status: 'confirmed', title: 'NEW', hint: 'Siap mulai dikerjakan', accent: 'warning' },
  { status: 'preparing', title: 'PREPARING', hint: 'Sedang disiapkan', accent: 'info' },
  { status: 'served', title: 'READY', hint: 'Siap disajikan', accent: 'success' },
]

const NEXT_ACTION = {
  confirmed: { next: 'preparing', label: 'Mulai Proses' },
  preparing: { next: 'served', label: 'Tandai Siap' },
  served: { next: 'completed', label: 'Selesaikan' },
}

/**
 * Warna kategori item. Key dicocokkan dengan kata kunci nama kategori
 * (mis. "Makanan Utama" cocok "makan"). Unknown → netral.
 */
const CATEGORY_COLORS = [
  { match: ['makan', 'food', 'utama'], accent: 'food' },
  { match: ['minum', 'beverage', 'drink'], accent: 'beverage' },
  { match: ['cemilan', 'snack', 'dessert'], accent: 'snack' },
]

function categoryAccent(categoryName) {
  const name = String(categoryName || '').toLowerCase()
  const hit = CATEGORY_COLORS.find((c) => c.match.some((m) => name.includes(m)))
  return hit?.accent || 'default'
}

/** Kelompokkan item order per kategori: [{ accent, label, items: [...] }] */
function groupItemsByCategory(items) {
  const groups = new Map()
  for (const item of items) {
    const catName = item.product?.category?.name || 'Lainnya'
    const accent = categoryAccent(catName)
    if (!groups.has(catName)) {
      groups.set(catName, { accent, label: catName, items: [] })
    }
    groups.get(catName).items.push(item)
  }
  // Urutkan: Makanan dulu, lalu Minuman, sisanya.
  const order = ['food', 'beverage', 'snack', 'default']
  return [...groups.values()].sort(
    (a, b) => order.indexOf(a.accent) - order.indexOf(b.accent),
  )
}

// Beep pendek via Web Audio API — tidak butuh file audio.
function playNewOrderBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
    osc.onended = () => ctx.close()
  } catch {
    // Audio diblokir browser — abaikan.
  }
}

function KdsCard({ order, busy, flash, onAction }) {
  const items = getOrderItems(order)
  const action = NEXT_ACTION[order.status]
  const groups = useMemo(() => groupItemsByCategory(items), [items])
  const buttonClass = {
    confirmed: 'kds-action--warning',
    preparing: 'kds-action--info',
    served: 'kds-action--success',
  }[order.status]

  return (
    <article className={`kds-card${flash ? ' kds-card--flash' : ''}`}>
      <header className="kds-card__head">
        <strong className="kds-card__number">{order.order_number}</strong>
        <span className="kds-card__table">Meja {order.table?.table_number || '-'}</span>
      </header>
      {order.customer_name && (
        <p className="kds-card__customer">{order.customer_name}</p>
      )}
      {groups.map((group) => (
        <div key={group.label} className={`kds-card__cat kds-card__cat--${group.accent}`}>
          <span className="kds-card__cat-label">{group.label}</span>
          <ul className="kds-card__items">
            {group.items.map((item) => {
              const opts = parseSelectedOptions(item.selected_options)
              return (
                <li key={item.id}>
                  <span>
                    {item.product?.name || 'Produk'} <strong>× {item.quantity}</strong>
                  </span>
                  {opts.length > 0 && (
                    <small className="kds-card__item-opts">
                      {' · '}Varian: {opts.map((o) => o.option_label).join(', ')}
                    </small>
                  )}
                  {item.notes && <small>Catatan: {item.notes}</small>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {order.notes && <p className="kds-card__note">Catatan order: {order.notes}</p>}
      {action && (
        <button
          type="button"
          className={`btn btn--primary btn--block kds-action ${buttonClass}`}
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
  // ID order yang baru masuk → efek flash singkat di kartunya.
  const [flashedIds, setFlashedIds] = useState([])
  const flashTimerRef = useRef(null)
  const knownOrderIdsRef = useRef(new Set())
  const isFirstLoadRef = useRef(true)

  useEffect(() => {
    prefetchIdle('/kitchen')
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [])

  // Tandai order yang sudah dikenal setelah data pertama termuat,
  // agar hanya order BARU di kemudian hari yang memicu beep/flash.
  useEffect(() => {
    if (!isFirstLoadRef.current) return
    if (loading) return
    for (const order of orders) knownOrderIdsRef.current.add(order.id)
    isFirstLoadRef.current = false
  }, [loading, orders])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel !== 'orders' && event?.channel !== 'dashboard') return
      refreshQuiet()
      if (event?.channel === 'orders' && event.payload?.type === 'order.created') {
        playNewOrderBeep()
        toastSuccess(`Pesanan baru masuk: ${event.payload.order_number || ''}`.trim())
      }
    },
  })

  // Tandai order yang belum dikenal sebagai "baru" → flash kartu.
  useEffect(() => {
    if (isFirstLoadRef.current) return
    const fresh = orders.filter((o) => !knownOrderIdsRef.current.has(o.id))
    if (fresh.length === 0) return
    for (const order of fresh) knownOrderIdsRef.current.add(order.id)
    setFlashedIds(fresh.map((o) => o.id))
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashedIds([]), 3000)
  }, [orders])

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
            <section
              key={col.status}
              className={`kds-column kds-column--${col.accent}`}
              aria-label={col.title}
            >
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
                      flash={flashedIds.includes(order.id)}
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
