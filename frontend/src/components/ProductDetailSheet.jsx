/* eslint-disable react-hooks/set-state-in-effect -- reset state saat sheet dibuka; komponen di-remount via key */
import { useEffect, useMemo, useState } from 'react'
import { getProduct, peekProductCache } from '../api/client'
import { formatRupiah, resolveImageUrl } from '../utils/format'
import { computeItemUnitPrice } from '../hooks/useCart'
import ErrorState from './ErrorState'
import QuantityStepper from './QuantityStepper'

export default function ProductDetailSheet({ open, productId, menuProducts = [], onClose, onAdd }) {
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  // Temukan produk secara sinkron dari menu / cache agar sheet tampil instan.
  const resolvedProduct = (() => {
    if (!open || !productId) return null
    const fromMenu = Array.isArray(menuProducts)
      ? menuProducts.find((p) => Number(p?.id) === Number(productId))
      : null
    return fromMenu || peekProductCache(productId)
  })()

  useEffect(() => {
    if (!open || !productId) return
    setError(null)
    setSelectedOptions([])
    setQuantity(1)

    if (resolvedProduct) {
      setProduct(resolvedProduct)
      // Revalidasi diam-diam agar harga/stok tetap segar tanpa menahan UI.
      getProduct(productId, { revalidate: true })
        .then((data) => {
          setProduct(data)
        })
        .catch(() => {
          // biarkan data cache tetap tampil
        })
      return
    }

    getProduct(productId)
      .then((data) => setProduct(data))
      .catch((err) => setError(err.message))
  }, [open, productId, reloadKey, resolvedProduct])

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

  const soldOut = product ? product.stock <= 0 : false
  const displayQuantity = product
    ? Math.max(1, Math.min(quantity, product.stock))
    : 1

  const unitPrice = useMemo(() => {
    return computeItemUnitPrice(product, selectedOptions)
  }, [product, selectedOptions])

  const retry = () => {
    setError(null)
    setReloadKey((n) => n + 1)
  }

  const handleToggleOption = (groupId, optionId) => {
    setSelectedOptions((prev) => {
      const group = product?.optionGroups?.find((g) => g.id === groupId)
      if (!group) return prev
      if (group.selection_type === 'single') {
        const existing = prev.find((o) => o.option_group_id === groupId)
        if (existing?.option_id === optionId) {
          return prev.filter((o) => o.option_group_id !== groupId)
        }
        return [
          ...prev.filter((o) => o.option_group_id !== groupId),
          { option_group_id: groupId, option_id: optionId },
        ]
      }
      const exists = prev.some(
        (o) => o.option_group_id === groupId && o.option_id === optionId
      )
      if (exists) {
        return prev.filter(
          (o) => !(o.option_group_id === groupId && o.option_id === optionId)
        )
      }
      return [...prev, { option_group_id: groupId, option_id: optionId }]
    })
  }

  const handleAdd = () => {
    if (!product) return
    onAdd(product, displayQuantity, selectedOptions)
    onClose()
  }

  if (!open) return null

  return (
    <div className="drawer drawer--sheet" role="dialog" aria-modal="true" aria-label="Detail produk">
      <div className="drawer__scrim" onClick={onClose} />
      <div className="drawer__panel drawer__panel--sheet">
        {error && (
          <div className="drawer__sheet-body">
            <ErrorState title="Gagal memuat produk" message={error} onRetry={retry} />
          </div>
        )}

        {product && !error && (
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
              <p className="detail-sheet__price">{formatRupiah(unitPrice)}</p>
              <p className="detail-sheet__stock">
                {soldOut ? 'Stok habis' : `Tersedia ${product.stock} porsi`}
              </p>
              {product.description && (
                <p className="detail-sheet__desc">{product.description}</p>
              )}

              {/* Varian / ops menu */}
              {product.optionGroups && product.optionGroups.length > 0 && (
                <div className="detail-sheet__options">
                  <p className="detail-sheet__options-title">Pilihan Varian</p>
                  {product.optionGroups.map((group) => (
                    <div key={group.id} className="detail-sheet__option-group">
                      <span className="detail-sheet__option-group-name">{group.name}</span>
                      <div className="detail-sheet__option-items">
                        {group.options.map((opt) => {
                          const isChecked = selectedOptions.some(
                            (o) => o.option_group_id === group.id && o.option_id === opt.id
                          )
                          return (
                            <label
                              key={opt.id}
                              className={`detail-sheet__option-item ${isChecked ? 'is-checked' : ''}`}
                            >
                              <input
                                type={group.selection_type === 'single' ? 'radio' : 'checkbox'}
                                name={`opt-group-${group.id}`}
                                checked={isChecked}
                                onChange={() => handleToggleOption(group.id, opt.id)}
                              />
                              <span className="detail-sheet__option-label">{opt.label}</span>
                              {Number(opt.additional_price) > 0 && (
                                <span className="detail-sheet__option-price">
                                  +{formatRupiah(opt.additional_price)}
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
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
                    onClick={handleAdd}
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
