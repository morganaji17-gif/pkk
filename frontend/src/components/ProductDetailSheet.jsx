import { useEffect, useState } from 'react'
import { getProduct } from '../api/client'
import { formatRupiah, resolveImageUrl } from '../utils/format'
import LoadingState from './LoadingState'
import ErrorState from './ErrorState'
import QuantityStepper from './QuantityStepper'

export default function ProductDetailSheet({ open, productId, onClose, onAdd }) {
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!open || !productId) return
    let cancelled = false
    const load = async () => {
      try {
        const data = await getProduct(productId)
        if (cancelled) return
        setProduct(data)
        setQuantity(1)
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
  }, [open, productId, reloadKey])

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

  const soldOut = product ? product.stock <= 0 : false
  const displayQuantity = product
    ? Math.max(1, Math.min(quantity, product.stock))
    : 1

  const retry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }

  return (
    <div className="drawer drawer--sheet" role="dialog" aria-modal="true" aria-label="Detail produk">
      <div className="drawer__scrim" onClick={onClose} />
      <div className="drawer__panel drawer__panel--sheet">
        {loading && <LoadingState label="Memuat detail produk…" />}

        {error && !loading && (
          <div className="drawer__sheet-body">
            <ErrorState title="Gagal memuat produk" message={error} onRetry={retry} />
          </div>
        )}

        {product && !loading && !error && (
          <>
            <div className="detail-sheet__media">
              {resolveImageUrl(product.image) ? (
                <img src={resolveImageUrl(product.image)} alt={product.name} />
              ) : (
                <div className="detail-sheet__placeholder" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                    <path d="M3 11l19-9-9 19-2-8-8-2z" />
                  </svg>
                </div>
              )}
              <button type="button" className="drawer__close drawer__close--floating" onClick={onClose} aria-label="Tutup detail produk">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="detail-sheet__body">
              {product.category && (
                <span className="detail-sheet__category">{product.category.name}</span>
              )}
              <h2 className="detail-sheet__name">{product.name}</h2>
              <p className="detail-sheet__price">{formatRupiah(product.price)}</p>
              <p className="detail-sheet__stock">
                {soldOut ? 'Stok habis' : `Tersedia ${product.stock} porsi`}
              </p>
              {product.description && (
                <p className="detail-sheet__desc">{product.description}</p>
              )}
            </div>

            <div className="drawer__footer">
              {soldOut ? (
                <div className="btn btn--disabled btn--block">Stok Habis</div>
              ) : (
                <>
                  <QuantityStepper
                    value={displayQuantity}
                    min={1}
                    max={product.stock}
                    onChange={setQuantity}
                  />
                  <button
                    type="button"
                    className="btn btn--primary btn--grow"
                    onClick={() => {
                      onAdd(product, displayQuantity)
                      onClose()
                    }}
                  >
                    Tambah ke Keranjang
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
