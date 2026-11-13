/* eslint-disable react-hooks/set-state-in-effect -- render cached data immediately */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getOrder,
  updateOrderStatus,
  confirmOrderPayment,
  rejectOrderPayment,
} from '../../../api/client'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import { formatRupiah, formatDateTime, resolveImageUrl, PAYMENT_METHOD_LABELS } from '../../../utils/format'
import LoadingState from '../../../components/LoadingState'
import ErrorState from '../../../components/ErrorState'
import { toastSuccess, toastError } from '../../../utils/swal'

const STATUS_ACTION_LABELS = {
  pending: 'Terima Pesanan',
  confirmed: 'Mulai Proses',
  preparing: 'Tandai Siap',
  served: 'Selesaikan',
  completed: 'Selesai',
  cancelled: 'Batalkan Pesanan',
}

const STATUS_BADGE_LABELS = {
  pending: 'Menunggu',
  confirmed: 'Diterima',
  preparing: 'Disiapkan',
  served: 'Siap',
  completed: 'Selesai',
  cancelled: 'Batal',
}

const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'served',
  served: 'completed',
}

// ── Tab: Detail ───────────────────────────────────────────────────────
function TabDetail({ order, onSetStatus }) {
  const subtotal = order.items?.reduce(
    (s, i) => s + Number(i.subtotal), 0
  ) ?? 0
  const tax = Number(order.tax_amount ?? 0)
  const discount = Number(order.discount_amount ?? 0)
  const service = Number(order.service_charge ?? 0)
  const grandTotal = Number(order.total_amount)

  return (
    <div className="cashier-detail-section">
      {/* Order items */}
      <div className="cashier-detail-card">
        <h3 className="cashier-detail-card__title">Item Pesanan</h3>
        <div className="cashier-detail-items">
          {order.items?.map((item, idx) => (
            <div key={idx} className="cashier-detail-item">
              <span className="cashier-detail-item__qty">{item.quantity}×</span>
              <div className="cashier-detail-item__info">
                <span className="cashier-detail-item__name">
                  {item.product?.name ?? item.product_name}
                </span>
                {item.selected_options?.length > 0 && (
                  <p className="cashier-detail-item__opts">
                    {item.selected_options.map((o) => o.label).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="cashier-detail-item__opts">📝 {item.notes}</p>
                )}
              </div>
              <span className="cashier-detail-item__price">
                {formatRupiah(item.subtotal)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="cashier-detail-totals">
          <div className="cashier-detail-total-row">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          {service > 0 && (
            <div className="cashier-detail-total-row">
              <span>Service Charge</span>
              <span>{formatRupiah(service)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="cashier-detail-total-row">
              <span>Pajak</span>
              <span>{formatRupiah(tax)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="cashier-detail-total-row">
              <span>Diskon</span>
              <span>− {formatRupiah(discount)}</span>
            </div>
          )}
          <div className="cashier-detail-total-row cashier-detail-total-row--grand">
            <span>Total</span>
            <span>{formatRupiah(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="cashier-detail-card">
        <h3 className="cashier-detail-card__title">Info Pesanan</h3>
        <div className="cashier-detail-items">
          <div className="cashier-detail-item">
            <span className="cashier-detail-item__qty" style={{ color: 'var(--color-muted-foreground)' }}>
              👤
            </span>
            <div className="cashier-detail-item__info">
              <span className="cashier-detail-item__name">{order.customer_name}</span>
            </div>
          </div>
          <div className="cashier-detail-item">
            <span className="cashier-detail-item__qty" style={{ color: 'var(--color-muted-foreground)' }}>
              🪑
            </span>
            <div className="cashier-detail-item__info">
              <span className="cashier-detail-item__name">
                Meja {order.restaurant_table?.table_number ?? '-'}
              </span>
            </div>
          </div>
          <div className="cashier-detail-item">
            <span className="cashier-detail-item__qty" style={{ color: 'var(--color-muted-foreground)' }}>
              📅
            </span>
            <div className="cashier-detail-item__info">
              <span className="cashier-detail-item__name">
                {formatDateTime(order.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action */}
      {onSetStatus && (
        <div className="cashier-detail-actions">
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onSetStatus}
            >
              {STATUS_ACTION_LABELS[order.status]}
            </button>
          )}
          {order.status === 'pending' && (
            <button
              type="button"
              className="btn btn--danger btn--outline"
              onClick={() =>
                onSetStatus({ target: { value: 'cancelled' } }, 'cancelled')
              }
            >
              Batalkan
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Pembayaran ──────────────────────────────────────────────────
function TabPembayaran({ order, onConfirmPayment, onRejectPayment }) {
  const isUnpaid = order.payment_status !== 'paid'
  const isQris = order.payment_method === 'qris'

  return (
    <div className="cashier-detail-section">
      <div className="cashier-detail-card">
        <h3 className="cashier-detail-card__title">Ringkasan Pembayaran</h3>
        <dl className="cashier-payment-summary">
          <div className="cashier-payment-row">
            <dt>Metode</dt>
            <dd>{PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}</dd>
          </div>
          <div className="cashier-payment-row">
            <dt>Status</dt>
            <dd>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '99px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background:
                    order.payment_status === 'paid'
                      ? 'var(--color-success-bg)'
                      : 'var(--color-warning-bg)',
                  color:
                    order.payment_status === 'paid'
                      ? 'var(--color-success)'
                      : 'var(--color-warning)',
                }}
              >
                {order.payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar'}
              </span>
            </dd>
          </div>
          <div className="cashier-payment-row">
            <dt>Total Bayar</dt>
            <dd>{formatRupiah(order.total_amount)}</dd>
          </div>
          {order.paid_at && (
            <div className="cashier-payment-row">
              <dt>Waktu Bayar</dt>
              <dd>{formatDateTime(order.paid_at)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Bukti Bayar (QRIS) */}
      {isQris && (order.proof_url || order.proof_image) && (
        <div className="cashier-detail-card">
          <h3 className="cashier-detail-card__title">Bukti Pembayaran</h3>
          <div className="cashier-payment-proof">
            <img
              src={resolveImageUrl(order.proof_url || order.proof_image)}
              alt="Bukti QRIS"
              className="cashier-payment-proof__img"
              onClick={() => window.open(resolveImageUrl(order.proof_url || order.proof_image), '_blank')}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isUnpaid && (
        <div className="cashier-detail-actions">
          {isQris && (order.proof_url || order.proof_image) && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onConfirmPayment}
            >
              ✓ Verifikasi Pembayaran
            </button>
          )}
          {isQris && (order.proof_url || order.proof_image) && (
            <button
              type="button"
              className="btn btn--danger btn--outline"
              onClick={onRejectPayment}
            >
              ✗ Tolak
            </button>
          )}
          {!isQris && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onConfirmPayment}
            >
              ✓ Tandai Lunas
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Struk ────────────────────────────────────────────────────────
function TabStruk({ order }) {
  return (
    <div className="cashier-detail-section">
      <div className="cashier-detail-card" style={{ background: 'white' }}>
        <div
          style={{
            width: '80mm',
            maxWidth: '80mm',
            boxSizing: 'border-box',
            color: '#000',
            padding: '12px',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          {/* Receipt header */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '14px' }}>PESAN.IN</strong>
            <br />
            <small>Struk Pembayaran</small>
          </div>

          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{order.order_number}</span>
              <span>{order.restaurant_table?.table_number ? `Meja ${order.restaurant_table.table_number}` : ''}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{order.customer_name}</span>
              <span>{formatDateTime(order.created_at)}</span>
            </div>
          </div>

          {/* Items */}
          {order.items?.map((item, idx) => (
            <div key={idx} style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {item.quantity}× {item.product?.name ?? item.product_name}
                </span>
                <span>{formatRupiah(item.subtotal)}</span>
              </div>
              {item.selected_options?.map((opt, oi) => (
                <div key={oi} style={{ paddingLeft: '12px', fontSize: '11px' }}>
                  · {opt.label}
                  {opt.additional_price > 0 && ` (+${formatRupiah(opt.additional_price)})`}
                </div>
              ))}
              {item.notes && (
                <div style={{ paddingLeft: '12px', fontSize: '11px', fontStyle: 'italic' }}>
                  📝 {item.notes}
                </div>
              )}
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span>
                {formatRupiah(
                  order.items?.reduce((s, i) => s + Number(i.subtotal), 0) ?? 0
                )}
              </span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Diskon</span>
                <span>− {formatRupiah(order.discount_amount)}</span>
              </div>
            )}
            {Number(order.service_charge) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Service</span>
                <span>{formatRupiah(order.service_charge)}</span>
              </div>
            )}
            {Number(order.tax_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pajak</span>
                <span>{formatRupiah(order.tax_amount)}</span>
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: '2px solid #000',
              paddingTop: '6px',
              marginTop: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 800,
            }}
          >
            <span>TOTAL</span>
            <span>{formatRupiah(order.total_amount)}</span>
          </div>

          {order.payment_method && (
            <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '11px' }}>
              {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method} ·{' '}
              {order.payment_status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px' }}>
            Terima kasih atas kunjungan Anda!
          </div>
        </div>

        {/* Print button */}
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ marginTop: '12px' }}
          onClick={() => window.print()}
        >
          🖨️ Cetak Struk
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
const TABS = [
  { id: 'detail', label: 'Detail', icon: '📋' },
  { id: 'pembayaran', label: 'Pembayaran', icon: '💳' },
  { id: 'struk', label: 'Struk', icon: '🧾' },
]

export default function CashierOrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('detail')

  const loadOrder = async () => {
    try {
      const data = await getOrder(id)
      setOrder(data)
      setError(null)
    } catch (err) {
      setError(err.message || 'Gagal memuat pesanan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per order id
  }, [id])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel !== 'orders') return
      if (event.payload?.order_id == id) {
        loadOrder()
      }
      if (event.payload?.type === 'order.created' || event.payload?.type === 'order.updated') {
        // reload if this order changed
        const nums = String(event.payload?.order_number || '').trim()
        if (nums && order?.order_number === nums) loadOrder()
      }
    },
  })

  const handleSetStatus = async (_, targetStatus) => {
    const newStatus = targetStatus ?? NEXT_STATUS[order.status]
    if (!newStatus) return
    try {
      await updateOrderStatus(id, newStatus)
      toastSuccess(`Status berubah ke "${STATUS_BADGE_LABELS[newStatus]}"`)
      loadOrder()
    } catch (err) {
      toastError(err.message || 'Gagal ubah status')
    }
  }

  const handleSetPayment = async () => {
    try {
      await confirmOrderPayment(id)
      toastSuccess('Pembayaran diverifikasi!')
      loadOrder()
    } catch (err) {
      toastError(err.message || 'Gagal verifikasi')
    }
  }

  const handleRejectPayment = async () => {
    try {
      await rejectOrderPayment(id)
      toastSuccess('Pembayaran ditolak.')
      loadOrder()
    } catch (err) {
      toastError(err.message || 'Gagal tolak')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState title="Gagal memuat" message={error} onRetry={loadOrder} />
  if (!order) return null

  return (
    <div className="cashier-detail">
      {/* Back */}
      <Link to="/cashier" className="cashier-detail__back">
        ← Kembali ke Daftar
      </Link>

      {/* Title bar */}
      <div className="cashier-detail__title-bar">
        <div>
          <h1 className="cashier-detail__title">{order.order_number}</h1>
          <p className="cashier-detail__subtitle">
            {order.customer_name} · Meja {order.restaurant_table?.table_number ?? '-'} ·{' '}
            <span
              style={{
                padding: '1px 8px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: 700,
                background:
                  order.status === 'pending'
                    ? 'var(--color-warning-bg)'
                    : order.status === 'cancelled'
                    ? 'var(--color-danger-bg)'
                    : order.status === 'completed' || order.status === 'served'
                    ? 'var(--color-success-bg)'
                    : 'var(--color-info-bg)',
                color:
                  order.status === 'pending'
                    ? 'var(--color-warning)'
                    : order.status === 'cancelled'
                    ? 'var(--color-danger)'
                    : order.status === 'completed' || order.status === 'served'
                    ? 'var(--color-success)'
                    : 'var(--color-info)',
              }}
            >
              {STATUS_BADGE_LABELS[order.status]}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--heading)',
              fontSize: '20px',
              fontWeight: 800,
            }}
          >
            {formatRupiah(order.total_amount)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <nav className="cashier-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`cashier-tabs__btn${activeTab === tab.id ? ' cashier-tabs__btn--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="cashier-tabs__btn-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="cashier-tab-content">
        {activeTab === 'detail' && (
          <TabDetail order={order} onSetStatus={handleSetStatus} />
        )}
        {activeTab === 'pembayaran' && (
          <TabPembayaran
            order={order}
            onConfirmPayment={handleSetPayment}
            onRejectPayment={handleRejectPayment}
          />
        )}
        {activeTab === 'struk' && <TabStruk order={order} />}
      </div>
    </div>
  )
}
