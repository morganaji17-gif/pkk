import { useEffect, useState } from 'react'
import { getPublicSettings } from '../api/client'
import { formatRupiah } from '../utils/format'

export default function CheckoutView({
  table,
  items,
  total,
  isAppending = false,
  existingOrderNumber,
  onBack,
  onSubmit,
  submitting,
  error,
  onClearError,
}) {
  const [name, setName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [orderNotes, setOrderNotes] = useState('')
  const [localError, setLocalError] = useState(null)
  const [qris, setQris] = useState(null)
  const [billing, setBilling] = useState({ service_charge_percent: 0, tax_percent: 0 })

  useEffect(() => {
    let cancelled = false
    getPublicSettings()
      .then((data) => {
        if (cancelled) return
        setQris({ image_url: data.image_url, instruction: data.instruction })
        setBilling({
          service_charge_percent: Number(data.service_charge_percent) || 0,
          tax_percent: Number(data.tax_percent) || 0,
        })
      })
      .catch(() => {
        if (cancelled) return
        setQris({ image_url: null, instruction: null })
        setBilling({ service_charge_percent: 0, tax_percent: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const subtotal = Number(total) || 0
  const serviceCharge = Math.round(subtotal * billing.service_charge_percent) / 100
  const tax = Math.round(subtotal * billing.tax_percent) / 100
  const grandTotal = subtotal + serviceCharge + tax

  const handleSubmit = (e) => {
    e.preventDefault()
    onClearError()
    setLocalError(null)
    if (!isAppending) {
      const trimmed = name.trim()
      if (!trimmed) {
        setLocalError('Nama tidak boleh kosong. Masukkan nama Anda untuk melanjutkan.')
        return
      }
      if (paymentMethod !== 'cash' && paymentMethod !== 'qris') {
        setLocalError('Pilih metode pembayaran terlebih dahulu.')
        return
      }
      onSubmit(trimmed, paymentMethod, orderNotes.trim())
      return
    }
    onSubmit('', 'cash', orderNotes.trim())
  }

  return (
    <div className="checkout-page">
      <div className="view-header">
        <button type="button" className="view-header__back" onClick={onBack} aria-label="Kembali ke menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="view-header__title">Checkout</h1>
      </div>

      <div className="checkout__table">
        <span className="checkout__table-label">Pesanan untuk</span>
        <span className="checkout__table-value">Meja {table.table_number}</span>
      </div>

      <ul className="checkout-list">
        {items.map(({ product, quantity }) => (
          <li key={product.id} className="checkout-item">
            <span className="checkout-item__name">
              {product.name} <span className="checkout-item__qty">× {quantity}</span>
            </span>
            <span className="checkout-item__subtotal">
              {formatRupiah(Number(product.price) * quantity)}
            </span>
          </li>
        ))}
      </ul>

      <form className="checkout-form" onSubmit={handleSubmit} noValidate>
      {isAppending ? (
        <div className="alert alert--info checkout-append">
          Menambahkan menu ke pesanan <strong>{existingOrderNumber}</strong>. Nama dan metode
          pembayaran tetap sama dengan pesanan sebelumnya.
        </div>
      ) : (
        <>
          <label className="field" htmlFor="customer-name">
            <span className="field__label">Nama Anda</span>
            <input
              id="customer-name"
              type="text"
              className="field__input"
              placeholder="Masukkan nama Anda"
              value={name}
              maxLength={100}
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value)
                if (localError) setLocalError(null)
              }}
            />
            <span className="field__hint">Nama ini akan tercantum pada pesanan.</span>
          </label>

          <fieldset className="checkout-payment">
            <legend className="field__label">Metode Pembayaran</legend>
            <div className="checkout-payment__methods" role="radiogroup" aria-label="Metode pembayaran">
              {[
                { value: 'cash', label: 'Cash' },
                { value: 'qris', label: 'QRIS' },
              ].map((method) => (
                <button
                  key={method.value}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === method.value}
                  className={`checkout-payment__method ${
                    paymentMethod === method.value ? 'checkout-payment__method--active' : ''
                  }`}
                  onClick={() => setPaymentMethod(method.value)}
                >
                  {method.label}
                </button>
              ))}
            </div>
            <span className="field__hint">
              Bayar di kasir saat pesanan selesai. Pilihan metode dapat dikonfirmasi oleh kasir.
            </span>

            {paymentMethod === 'qris' && (
              <div className="checkout-qris">
                {qris?.image_url ? (
                  <>
                    <img
                      src={qris.image_url}
                      alt="Kode QRIS restoran"
                      className="checkout-qris__img"
                    />
                    <p className="checkout-qris__hint">
                      {qris.instruction ||
                        'Scan QRIS di atas menggunakan aplikasi pembayaran Anda, lalu tunjukkan bukti pembayaran ke kasir.'}
                    </p>
                  </>
                ) : (
                  <p className="checkout-qris__hint">
                    Pembayaran QRIS akan diminta oleh kasir di tempat. Silakan siapkan aplikasi
                    pembayaran Anda.
                  </p>
                )}
              </div>
            )}
          </fieldset>
        </>
      )}

      <label className="field" htmlFor="order-notes">
        <span className="field__label">Catatan Pesanan (opsional)</span>
        <textarea
          id="order-notes"
          className="field__input checkout-notes"
          rows={3}
          maxLength={1000}
          placeholder="Contoh: Pisahkan pesanan untuk 2 orang."
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
        />
        <span className="field__hint">Catatan ini akan dilihat oleh kasir dan dapur.</span>
      </label>

        {error && <div className="alert alert--error">{error}</div>}
        {!error && localError && <div className="alert alert--error">{localError}</div>}

        <div className="checkout-summary">
          <div className="checkout-summary__row">
            <span>Subtotal</span>
            <strong>{formatRupiah(subtotal)}</strong>
          </div>
          {serviceCharge > 0 && (
            <div className="checkout-summary__row">
              <span>Service Charge</span>
              <strong>{formatRupiah(serviceCharge)}</strong>
            </div>
          )}
          {tax > 0 && (
            <div className="checkout-summary__row">
              <span>PPN</span>
              <strong>{formatRupiah(tax)}</strong>
            </div>
          )}
          <div className="checkout-summary__row">
            <span>Total</span>
            <strong>{formatRupiah(grandTotal)}</strong>
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Mengirim pesanan…' : 'Buat Pesanan'}
          </button>
        </div>
      </form>
    </div>
  )
}
