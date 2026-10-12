import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder, updateOrderStatus, confirmOrderPayment, rejectOrderPayment } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import { formatDateTime, resolveImageUrl, PAYMENT_METHOD_LABELS } from '../../../utils/format'
import LoadingState from '../../../components/LoadingState'
import ErrorState from '../../../components/ErrorState'
import OrderDetail from '../../components/OrderDetail'
import Receipt from '../../components/Receipt'
import PageHeader from '../../components/PageHeader'
import { toastSuccess } from '../../../utils/swal'

const STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'served',
  'completed',
  'cancelled',
]

const STATUS_ACTION_LABELS = {
  pending: 'Terima Pesanan',
  confirmed: 'Mulai Proses',
  preparing: 'Tandai Siap',
  served: 'Selesaikan',
  completed: 'Selesai',
  cancelled: 'Batalkan Pesanan',
}

function nextStatusCta(current, role) {
  if (role === 'kitchen') {
    if (current === 'confirmed') return 'preparing'
    if (current === 'preparing') return 'served'
    if (current === 'served') return 'completed'
    return null
  }
  if (role === 'cashier') {
    if (current === 'pending') return 'confirmed'
    if (current === 'served') return 'completed'
    return null
  }
  if (current === 'pending') return 'confirmed'
  if (current === 'confirmed') return 'preparing'
  if (current === 'preparing') return 'served'
  if (current === 'served') return 'completed'
  return null
}

export default function CashierOrderDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const isKitchen = user?.role === 'kitchen'
  const backTo = user?.role === 'admin' ? '/admin/orders' : user?.role === 'kitchen' ? '/kitchen' : '/cashier'
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyStatus, setBusyStatus] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busyPayment, setBusyPayment] = useState(false)
  const [paymentError, setPaymentError] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      try {
        const data = await getOrder(id, { revalidate: true })
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
  }, [id, reloadKey])

  const retry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }

  // Live: perubahan dari aktor lain (dapur/kasir lain) masuk tanpa reload.
  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel !== 'orders' && event?.channel !== 'dashboard') return
      const num = event.payload?.order_number
      if (num && order && num !== order.order_number) return
      getOrder(id, { revalidate: true })
        .then((data) => {
          setOrder(data)
          setError(null)
        })
        .catch(() => {})
    },
  })

  const handleSetStatus = async (status) => {
    if (!order || busyStatus) return
    setBusyStatus(status)
    setActionError(null)
    try {
      const data = await updateOrderStatus(order.id, status)
      setOrder((prev) =>
        prev ? { ...prev, status: data.status, updated_at: data.updated_at } : data
      )
      toastSuccess('Status pesanan diperbarui')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyStatus(null)
    }
  }

  const handleSetPayment = async () => {
    if (!order || busyPayment || order.payment_status === 'paid') return
    setBusyPayment(true)
    setPaymentError(null)
    try {
      const data = await confirmOrderPayment(order.id)
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              payment_status: data.payment_status,
              payment_method: data.payment_method,
              paid_at: data.paid_at,
              proof_url: data.proof_url,
              updated_at: data.updated_at,
            }
          : data
      )
      toastSuccess('Pembayaran dikonfirmasi')
    } catch (err) {
      setPaymentError(
        err.status === 403
          ? 'Anda tidak memiliki akses untuk memproses pembayaran.'
          : err.message
      )
    } finally {
      setBusyPayment(false)
    }
  }

  const handleRejectPayment = async () => {
    if (!order || busyPayment) return
    setBusyPayment(true)
    setPaymentError(null)
    try {
      const data = await rejectOrderPayment(order.id, rejectNote.trim())
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              payment_status: data.payment_status,
              proof_image: data.proof_image,
              proof_url: data.proof_url,
              payment_reject_note: data.payment_reject_note,
              updated_at: data.updated_at,
            }
          : data
      )
      setShowReject(false)
      setRejectNote('')
      toastSuccess('Bukti pembayaran ditolak')
    } catch (err) {
      setPaymentError(err.message)
    } finally {
      setBusyPayment(false)
    }
  }

  if (loading) {
    return <LoadingState label="Memuat detail pesanan…" />
  }

  if (error && !order) {
    return (
      <ErrorState title="Gagal memuat pesanan" message={error} onRetry={retry} />
    )
  }

  if (!order) return null

  const cta = nextStatusCta(order.status, user?.role)
  const isCashier = user?.role === 'cashier'
  const canCancel = !isKitchen && !['cancelled', 'completed'].includes(order.status)
  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method || '-'
  const proofSrc = resolveImageUrl(order.proof_url || order.proof_image)

  return (
    <div className="staff-dashboard">
      <PageHeader
        title={`Order ${order.order_number}`}
        subtitle={isKitchen ? 'Panel dapur — fokus status masakan.' : 'Perbarui status dan pembayaran dari halaman ini.'}
        actions={
          <Link to={backTo} className="btn btn--secondary">
            ← Kembali
          </Link>
        }
      />

      <OrderDetail order={order} />
      <button 
        type="button"
        className="btn btn--secondary"
        onClick={() => setShowReceipt(true)}>
          🧾 Lihat & Cetak Struk
      </button>

      {showReceipt && (
  <section className="receipt-section">
    <Receipt order={order} />

    <div className="receipt-actions">
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => window.print()}
      >
        🖨️ Cetak Struk
      </button>

      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => setShowReceipt(false)}
      >
        Tutup Struk
      </button>
    </div>
  </section>
)}

      {actionError && <div className="alert alert--error">{actionError}</div>}

      <section className="staff-status-actions" aria-label="Perbarui status">
        <h3 className="staff-status-actions__title">Ubah Status</h3>
        {isKitchen && (
          <p className="staff-payment__hint">
            Akun dapur hanya boleh confirmed → preparing → served (siap) → completed.
          </p>
        )}
        {isCashier && (
          <p className="staff-payment__hint">
            Akun kasir hanya boleh menerima pending menjadi confirmed, menyelesaikan served menjadi completed, dan verifikasi pembayaran. Proses memasak dilakukan dapur.
          </p>
        )}
        {cta && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={Boolean(busyStatus)}
            onClick={() => handleSetStatus(cta)}
          >
            {busyStatus === cta ? 'Memperbarui…' : STATUS_ACTION_LABELS[order.status]}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            className="btn btn--secondary"
            disabled={Boolean(busyStatus)}
            onClick={() => handleSetStatus('cancelled')}
          >
            {busyStatus === 'cancelled' ? 'Memperbarui…' : 'Batalkan Pesanan'}
          </button>
        )}
        {!isKitchen && !isCashier && (
        <div className="staff-status-actions__list">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`staff-badge staff-badge--${status} ${
                order.status === status ? 'staff-status-chip--active' : 'staff-status-chip'
              }`}
              disabled={Boolean(busyStatus)}
              onClick={() => handleSetStatus(status)}
            >
              {busyStatus === status ? '…' : STATUS_ACTION_LABELS[status]}
            </button>
          ))}
        </div>
        )}
      </section>

      {!isKitchen && (
      <section className="staff-payment-actions" aria-label="Pembayaran">
        <h3 className="staff-status-actions__title">Pembayaran</h3>

        {(order.proof_url || order.proof_image) && order.payment_status !== 'paid' && (
          <div className="staff-proof">
            <p className="staff-payment__hint">Bukti pembayaran QRIS dari pelanggan:</p>
            {proofSrc && (
              <a href={proofSrc} target="_blank" rel="noreferrer">
                <img src={proofSrc} alt="Bukti pembayaran" style={{ maxWidth: 320, borderRadius: 8 }} />
              </a>
            )}
            {order.payment_reject_note && (
              <p className="alert alert--error">Ditolak sebelumnya: {order.payment_reject_note}</p>
            )}
          </div>
        )}

        {order.payment_status === 'paid' ? (
          <div className="staff-payment__paid">
            <div className="staff-payment__row">
              <dt>Status</dt>
              <dd>
                <span className="staff-badge staff-badge--served">Lunas</span>
              </dd>
            </div>
            <div className="staff-payment__row">
              <dt>Metode</dt>
              <dd>{paymentMethodLabel}</dd>
            </div>
            <div className="staff-payment__row">
              <dt>Dibayar</dt>
              <dd>{formatDateTime(order.paid_at)}</dd>
            </div>
          </div>
        ) : (
          <>
            <div className="staff-payment__row">
              <dt>Status</dt>
              <dd>
                <span className="staff-badge staff-badge--cancelled">Belum Dibayar</span>
              </dd>
            </div>
            <div className="staff-payment__row">
              <dt>Metode</dt>
              <dd>{paymentMethodLabel}</dd>
            </div>
            {order.payment_method === 'qris' && !(order.proof_url || order.proof_image) && (
              <p className="alert alert--error">
                Belum ada bukti pembayaran. Minta pelanggan mengunggah via halaman tracking.
              </p>
            )}
            <p className="staff-payment__hint">
              Pelanggan telah memilih metode pembayaran. Kasir hanya perlu
              mengonfirmasi pembayaran saat sudah diterima.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busyPayment}
              onClick={handleSetPayment}
            >
              {busyPayment ? 'Memproses…' : 'Konfirmasi Pembayaran'}
            </button>
            {(order.proof_url || order.proof_image) && (
              <button
                type="button"
                className="btn btn--secondary"
                disabled={busyPayment}
                onClick={() => setShowReject((v) => !v)}
              >
                Tolak Bukti
              </button>
            )}
            </div>
            {showReject && (
              <div className="field" style={{ marginTop: 12 }}>
                <label className="field__label" htmlFor="reject-note">Alasan penolakan (opsional)</label>
                <input
                  id="reject-note"
                  className="field__input"
                  type="text"
                  maxLength={500}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Contoh: foto buram, nominal tidak sesuai"
                />
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn--secondary" disabled={busyPayment} onClick={handleRejectPayment}>
                    {busyPayment ? 'Memproses…' : 'Kirim Penolakan'}
                  </button>
                </div>
              </div>
            )}
            {paymentError && <div className="alert alert--error">{paymentError}</div>}
          </>
        )}
      </section>
      )}
    </div>
  )
}
