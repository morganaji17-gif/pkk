import { useEffect, useState } from 'react'
import { trackOrder, uploadOrderProof } from '../api/client'
import { useRealtimePoll } from '../hooks/useRealtimePoll'
import { getOrderEventsPollUrl } from '../api/client'
import { formatRupiah, formatDateTime, resolveImageUrl, PAYMENT_METHOD_LABELS, getOrderItems } from '../utils/format'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

const STATUS_LABELS = {
  pending: 'Menunggu Konfirmasi Kasir',
  confirmed: 'Diterima Kasir',
  preparing: 'Sedang Disiapkan',
  served: 'Siap Disajikan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

const STATUS_HINTS = {
  pending: 'Pesanan Anda menunggu untuk diterima kasir.',
  confirmed: 'Pesanan Anda sudah diterima dan diteruskan ke dapur.',
  preparing: 'Dapur sedang menyiapkan pesanan Anda.',
  served: 'Pesanan sudah siap dan segera disajikan ke meja Anda.',
  completed: 'Pesanan Anda telah selesai.',
  cancelled: 'Pesanan Anda telah dibatalkan.',
}

export default function OrderTrackingView({ trackingToken, onNewOrder, onAddMenu }) {
  const token = trackingToken
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [proofFile, setProofFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const load = async () => {
      try {
        const data = await trackOrder(token)
        if (cancelled) return
        setOrder(data)
      } catch (err) {
        if (cancelled) return
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  const refresh = async () => {
    if (!token) return
    setError(null)
    setRefreshing(true)
    try {
      const data = await trackOrder(token, { revalidate: true })
      setOrder(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const retry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }

  const handleUploadProof = async () => {
    if (!token || !proofFile || uploading) return
    setUploading(true)
    setUploadError(null)
    try {
      const data = await uploadOrderProof(token, proofFile)
      setOrder(data)
      setProofFile(null)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  useRealtimePoll({
    url: token ? getOrderEventsPollUrl(token) : null,
    enabled: Boolean(token),
    onEvent: () => {
      trackOrder(token, { revalidate: true })
        .then((data) => {
          setOrder(data)
          setError(null)
        })
        .catch(() => {})
    },
  })

  if (loading) {
    return <LoadingState label="Memuat status pesanan…" />
  }

  if (error && !order) {
    return (
      <ErrorState title="Gagal memuat pesanan" message={error} onRetry={retry} />
    )
  }

  if (!order) return null

  const statusLabel = STATUS_LABELS[order.status] || order.status
  const statusHint = STATUS_HINTS[order.status]
  const canAddMenu = ['pending', 'confirmed', 'preparing'].includes(order.status)
  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method || '-'
  const proofSrc = resolveImageUrl(order.proof_url || order.proof_image)
  const needsProof = order.payment_method === 'qris' && order.payment_status !== 'paid'
  const paymentLabel =
    order.payment_status === 'paid'
      ? `Lunas · ${formatDateTime(order.paid_at)}`
      : proofSrc
        ? 'Bukti terkirim · menunggu verifikasi kasir'
        : 'Menunggu pembayaran'
  const items = getOrderItems(order)

  return (
    <div className="tracking-page">
      <div className="success-hero">
        <div className="success-hero__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className="success-hero__title">Pesanan Diterima</h1>
        <p className="success-hero__subtitle">
          Pesanan Anda telah kami terima dan sedang diproses.
        </p>
      </div>

      <dl className="order-card">
        <div className="order-card__row">
          <dt>Nomor Order</dt>
          <dd className="order-card__number">{order.order_number}</dd>
        </div>
        <div className="order-card__row">
          <dt>Nama Customer</dt>
          <dd>{order.customer_name}</dd>
        </div>
        {order.notes && (
          <div className="order-card__row">
            <dt>Catatan</dt>
            <dd>{order.notes}</dd>
          </div>
        )}
        <div className="order-card__row">
          <dt>Meja</dt>
          <dd>Meja {order.table?.table_number || '-'}</dd>
        </div>
        {Number(order.subtotal) > 0 && (
          <>
            <div className="order-card__row">
              <dt>Subtotal</dt>
              <dd>{formatRupiah(order.subtotal)}</dd>
            </div>
            {Number(order.service_charge) > 0 && (
              <div className="order-card__row">
                <dt>Service Charge</dt>
                <dd>{formatRupiah(order.service_charge)}</dd>
              </div>
            )}
            {Number(order.tax) > 0 && (
              <div className="order-card__row">
                <dt>PPN</dt>
                <dd>{formatRupiah(order.tax)}</dd>
              </div>
            )}
          </>
        )}
        <div className="order-card__row">
          <dt>Total</dt>
          <dd className="order-card__total">{formatRupiah(order.total_price)}</dd>
        </div>
        <div className="order-card__row">
          <dt>Metode Pembayaran</dt>
          <dd>{paymentMethodLabel}</dd>
        </div>
        <div className="order-card__row">
          <dt>Pembayaran</dt>
          <dd className={order.payment_status === 'paid' ? 'order-card__paid' : ''}>
            {paymentLabel}
          </dd>
        </div>
        {order.payment_reject_note && order.payment_status !== 'paid' && (
          <div className="order-card__row">
            <dt>Catatan kasir</dt>
            <dd>{order.payment_reject_note}</dd>
          </div>
        )}
      </dl>

      {needsProof && (
        <div className="tracking-items">
          <h2 className="tracking-items__title">Bukti Pembayaran QRIS</h2>
          {proofSrc && (
            <p>
              <img src={proofSrc} alt="Bukti pembayaran Anda" style={{ maxWidth: 280, borderRadius: 8 }} />
            </p>
          )}
          <p className="success-note">
            {proofSrc
              ? 'Bukti sudah terkirim. Jika ditolak kasir, unggah ulang foto yang lebih jelas.'
              : 'Setelah membayar via QRIS, unggah foto bukti di sini agar kasir dapat memverifikasi.'}
          </p>
          <div className="field">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            />
          </div>
          {uploadError && <div className="alert alert--error">{uploadError}</div>}
          <button
            type="button"
            className="btn btn--secondary btn--block"
            disabled={!proofFile || uploading}
            onClick={handleUploadProof}
          >
            {uploading ? 'Mengunggah…' : 'Unggah Bukti Pembayaran'}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="tracking-items">
          <h2 className="tracking-items__title">Pesanan Anda</h2>
          <ul className="checkout-list tracking-items__list">
            {items.map((item) => (
              <li key={item.id} className="checkout-item">
                <span className="checkout-item__name">
                  {item.product?.name || 'Produk'}
                  <span className="checkout-item__qty"> × {item.quantity}</span>
                </span>
                <span className="checkout-item__subtotal">
                  {formatRupiah(item.subtotal ?? Number(item.price) * item.quantity)}
                </span>
                {item.notes && (
                  <span className="checkout-item__note">Catatan: {item.notes}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`status-card status-card--${order.status}`}>
        <span className="status-badge">{statusLabel}</span>
        {statusHint && <p className="status-card__hint">{statusHint}</p>}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="tracking-actions">
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? 'Memperbarui status…' : 'Refresh Status'}
        </button>
        {canAddMenu && onAddMenu && (
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => onAddMenu(order)}
          >
            Tambah Menu
          </button>
        )}
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={onNewOrder}
        >
          Buat Pesanan Baru
        </button>
      </div>

      <p className="success-note">
        Status dapat berubah sewaktu-waktu. Tekan Refresh Status untuk melihat
        pembaruan terbaru.
      </p>
    </div>
  )
}
