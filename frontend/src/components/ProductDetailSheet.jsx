/* eslint-disable react-hooks/set-state-in-effect -- reset state saat sheet dibuka; komponen di-remount via key */
import { useEffect, useMemo, useState } from 'react'
import { getProduct, peekProductCache } from '../api/client'
import { formatRupiah, resolveImageUrl } from '../utils/format'
import { computeItemUnitPrice } from '../hooks/useCart'
import ErrorState from './ErrorState'
import QuantityStepper from './QuantityStepper'
import Swal from 'sweetalert2'

export default function ProductDetailSheet({ open, productId, menuProducts = [], onClose, onAdd }) {
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)

  // Temukan produk secara sinkron dari menu / cache agar sheet tampil instan.
  // Nilai sengaja TIDAK masuk deps useEffect: objek cache selalu referensi baru
  // (normalizeProduct), sehingga deps tersebut akan memicu loop tak berujung.
  // Komponen di-remount via key saat productId berubah, jadi efek tetap berjalan.
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
    setImageFailed(false)

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
    // resolvedProduct sengaja tidak masuk deps: objek cache selalu referensi baru
    // (normalizeProduct), dan komponen sudah di-remount via key saat produk ganti.
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

  const optionGroups = (product?.optionGroups || product?.option_groups || []).filter(
    (group) => Array.isArray(group.options) && group.options.length > 0
  )

  const handleToggleOption = (groupId, optionId) => {
    setSelectedOptions((prev) => {
      const group = optionGroups.find((g) => Number(g.id) === Number(groupId))
      const option = group?.options?.find((o) => Number(o.id) === Number(optionId))
      if (!group || !option) return prev

      const entry = {
        option_group_id: Number(group.id),
        option_id: Number(option.id),
        option_label: option.label,
        additional_price: Number(option.additional_price) || 0,
      }

      if (group.selection_type === 'single') {
        const existing = prev.find((o) => Number(o.option_group_id) === Number(groupId))
        if (existing && Number(existing.option_id) === Number(optionId)) {
          return prev.filter((o) => Number(o.option_group_id) !== Number(groupId))
        }
        return [
          ...prev.filter((o) => Number(o.option_group_id) !== Number(groupId)),
          entry,
        ]
      }

      const exists = prev.some(
        (o) => Number(o.option_group_id) === Number(groupId) && Number(o.option_id) === Number(optionId)
      )
      if (exists) {
        return prev.filter(
          (o) => !(Number(o.option_group_id) === Number(groupId) && Number(o.option_id) === Number(optionId))
        )
      }
      return [...prev, entry]
    })
  }

  const handleAdd = () => {
    if (!product) return
    const validation = validateOptions()
    if (!validation.valid) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: validation.message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      })
      return
    }
    onAdd(product, displayQuantity, selectedOptions)
    onClose()
  }

  const validateOptions = () => {
    for (const group of optionGroups) {
      const count = selectedOptions.filter((o) => Number(o.option_group_id) === Number(group.id)).length
      const min = group.required
        ? Math.max(1, Number(group.min_selections) || 0)
        : Math.max(0, Number(group.min_selections) || 0)
      const max = group.selection_type === 'single'
        ? 1
        : (group.max_selections === null || group.max_selections === undefined
            ? 99
            : Number(group.max_selections))

      if (count < min) {
        return { valid: false, message: `Pilih minimal ${min} opsi untuk "${group.name}".` }
      }
      if (count > max) {
        return { valid: false, message: `Pilih maksimal ${max} opsi untuk "${group.name}".` }
      }
    }
    return { valid: true }
  }

  const areAllOptionsSelected = () => {
    if (optionGroups.length === 0) return true
    for (const group of optionGroups) {
      const count = selectedOptions.filter((o) => Number(o.option_group_id) === Number(group.id)).length
      const min = group.required
        ? Math.max(1, Number(group.min_selections) || 0)
        : Math.max(0, Number(group.min_selections) || 0)
      if (count < min) return false
    }
    return true
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
              {resolveImageUrl(product.image) && !imageFailed ? (
                <img
                  src={resolveImageUrl(product.image)}
                  alt={product.name}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="detail-sheet__placeholder" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
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
              {optionGroups.length > 0 && (
                <div className="detail-sheet__options">
                  <p className="detail-sheet__options-title">Pilihan Varian</p>
                  {optionGroups.map((group) => (
                    <div key={group.id} className="detail-sheet__option-group">
                      <span className="detail-sheet__option-group-name">
                        {group.name}
                        {group.required && (
                          <span className="detail-sheet__required">Wajib pilih</span>
                        )}
                        {group.selection_type === 'single' && (
                          <span className="detail-sheet__option-count">1 dari 1</span>
                        )}
                        {group.selection_type === 'multiple' && group.min_selections > 0 && (
                          <span className="detail-sheet__option-count">{group.min_selections}–{group.max_selections ?? '∞'}</span>
                        )}
                      </span>
                      <div className="detail-sheet__option-items">
                        {group.options.map((opt) => {
                          const isChecked = selectedOptions.some(
                            (o) => Number(o.option_group_id) === Number(group.id) && Number(o.option_id) === Number(opt.id)
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
                    className={`btn btn--primary btn--grow${areAllOptionsSelected() ? '' : ' btn--dimmed'}`}
                    disabled={!areAllOptionsSelected()}
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
