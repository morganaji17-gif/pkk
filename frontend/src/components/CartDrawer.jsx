import { useEffect } from 'react'
import { formatRupiah, resolveImageUrl } from '../utils/format'
import QuantityStepper from './QuantityStepper'
import EmptyState from './EmptyState'

export default function CartDrawer({ open, items, total, onClose, onUpdateQty, onRemove, onSetNotes, onCheckout }) {
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Keranjang">
      <div className="drawer__scrim" onClick={onClose} />
      <div className="drawer__panel">
        <div className="drawer__header">
          <h2>Keranjang</h2>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Tutup keranjang">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon="cart"
            title="Keranjang kosong"
            message="Tambahkan menu favorit Anda untuk mulai memesan."
          />
        ) : (
          <>
            <ul className="cart-list">
              {items.map(({ product, quantity, notes }) => (
                <li key={product.id} className="cart-item">
                  {resolveImageUrl(product.image) ? (
                    <img
                      className="cart-item__thumb"
                      src={resolveImageUrl(product.image)}
                      alt={product.name}
                    />
                  ) : (
                    <div className="cart-item__thumb cart-item__thumb--placeholder" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                        <path d="M3 11l19-9-9 19-2-8-8-2z" />
                      </svg>
                    </div>
                  )}
                  <div className="cart-item__body">
                    <p className="cart-item__name">{product.name}</p>
                    <p className="cart-item__price">{formatRupiah(product.price)}</p>
                    <div className="cart-item__row">
                      <QuantityStepper
                        value={quantity}
                        min={1}
                        max={product.stock}
                        size="sm"
                        onChange={(next) => onUpdateQty(product.id, next)}
                      />
                      <p className="cart-item__subtotal">{formatRupiah(Number(product.price) * quantity)}</p>
                      <button
                        type="button"
                        className="cart-item__remove"
                        onClick={() => onRemove(product.id)}
                        aria-label={`Hapus ${product.name} dari keranjang`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                    {onSetNotes && (
                      <input
                        type="text"
                        className="cart-item__notes"
                        maxLength={255}
                        placeholder="Catatan untuk menu ini (opsional)"
                        value={notes || ''}
                        onChange={(e) => onSetNotes(product.id, e.target.value)}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="cart-summary">
              <div className="cart-summary__row">
                <span>Total</span>
                <strong>{formatRupiah(total)}</strong>
              </div>
              <button type="button" className="btn btn--primary btn--block" onClick={onCheckout}>
                Lanjut ke Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
