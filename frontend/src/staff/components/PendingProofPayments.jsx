/* eslint-disable react-hooks/set-state-in-effect -- sync from context prop */
import { useEffect, useState } from 'react'
import { confirmOrderPayment, rejectOrderPayment } from '../../api/client'
import { formatDateTime, formatRupiah, resolveImageUrl } from '../../utils/format'
import { toastError, toastSuccess } from '../../utils/swal'
import { notifyDashboardStatsRefresh } from '../hooks/useDashboardStats'
import { useDashboardStats } from '../context/DashboardStatsContext'

/**
 * Panel bukti pembayaran QRIS yang menunggu verifikasi.
 * Admin/kasir dapat langsung ACC atau menolak dari dashboard.
 */
export default function PendingProofPayments() {
  const stats = useDashboardStats()
  const [entries, setEntries] = useState(() => stats.pending_proof_list || [])
  const [busyId, setBusyId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    setEntries(stats.pending_proof_list || [])
  }, [stats.pending_proof_list])

  const removeFromList = (id) =>
    setEntries((prev) => prev.filter((item) => item.id !== id))

  const handleConfirm = async (item) => {
    setBusyId(item.id)
    setError(null)
    try {
      await confirmOrderPayment(item.id)
      removeFromList(item.id)
      notifyDashboardStatsRefresh()
      toastSuccess(`Pembayaran ${item.order_number} dikonfirmasi`)
    } catch (err) {
      setError(err.message || 'Gagal mengonfirmasi pembayaran.')
      toastError('Gagal mengonfirmasi pembayaran')
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (item) => {
    setBusyId(item.id)
    setError(null)
    try {
      await rejectOrderPayment(item.id, rejectNote.trim())
      removeFromList(item.id)
      setRejectingId(null)
      setRejectNote('')
      notifyDashboardStatsRefresh()
      toastSuccess(`Bukti ${item.order_number} ditolak`)
    } catch (err) {
      setError(err.message || 'Gagal menolak bukti pembayaran.')
      toastError('Gagal menolak bukti pembayaran')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="proof-acc">
      {error && <div className="alert alert--error">{error}</div>}
      {entries.length === 0 ? (
        <p className="chart-empty chart-empty--compact">Tidak ada bukti pembayaran menunggu verifikasi.</p>
      ) : (
        <ul className="proof-acc__list">
          {entries.map((item) => {
            const proofSrc = resolveImageUrl(item.proof_url)
            return (
              <li key={item.id} className="proof-acc__item">
                <a
                  href={proofSrc || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="proof-acc__thumb"
                  aria-label={`Lihat bukti pembayaran ${item.order_number}`}
                >
                  {proofSrc ? (
                    <img src={proofSrc} alt="Bukti pembayaran" loading="lazy" />
                  ) : (
                    <span className="proof-acc__thumb-fallback" aria-hidden="true">?</span>
                  )}
                </a>
                <div className="proof-acc__info">
                  <a href={`/admin/orders/${item.id}`} className="proof-acc__order">
                    {item.order_number}
                  </a>
                  <span className="proof-acc__meta">
                    Meja {item.table || '-'} · {item.customer_name || '-'} ·{' '}
                    {item.uploaded_at ? formatDateTime(item.uploaded_at) : '—'}
                  </span>
                  <span className="proof-acc__total">{formatRupiah(item.total_price)}</span>
                </div>
                <div className="proof-acc__actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={busyId === item.id}
                    onClick={() => handleConfirm(item)}
                  >
                    {busyId === item.id ? '…' : 'ACC'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={busyId === item.id}
                    onClick={() => {
                      setRejectingId(rejectingId === item.id ? null : item.id)
                      setRejectNote('')
                    }}
                  >
                    Tolak
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {rejectingId !== null && (
        <div className="field proof-acc__reject">
          <label className="field__label" htmlFor={`reject-note-${rejectingId}`}>
            Alasan penolakan (opsional)
          </label>
          <input
            id={`reject-note-${rejectingId}`}
            className="field__input"
            type="text"
            maxLength={500}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Contoh: foto buram, nominal tidak sesuai"
          />
          <div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={busyId !== null}
              onClick={() => {
                const item = entries.find((i) => i.id === rejectingId)
                if (item) handleReject(item)
              }}
            >
              {busyId !== null ? 'Memproses…' : 'Kirim'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
