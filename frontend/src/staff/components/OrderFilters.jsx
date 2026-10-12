import { useState } from 'react'

const STATUS_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'confirmed', label: 'Diterima' },
  { value: 'preparing', label: 'Disiapkan' },
  { value: 'served', label: 'Siap' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

const PAYMENT_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'paid', label: 'Lunas' },
  { value: 'unpaid', label: 'Belum Dibayar' },
]

export default function OrderFilters({ value, onChange, disabled }) {
  const [draft, setDraft] = useState(value.search || '')

  const set = (patch) => onChange({ ...value, ...patch })

  const applySearch = () => {
    set({ search: draft })
  }

  return (
    <div className="report-toolbar order-filters">
      <label className="report-field order-filters__search">
        <span className="report-field__label">Cari</span>
        <input
          type="search"
          className="field__input"
          placeholder="Nomor order atau nama customer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              applySearch()
            }
          }}
          disabled={disabled}
        />
      </label>

      <label className="report-field">
        <span className="report-field__label">Status</span>
        <select
          className="field__input"
          value={value.status || ''}
          onChange={(e) => set({ status: e.target.value })}
          disabled={disabled}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="report-field">
        <span className="report-field__label">Pembayaran</span>
        <select
          className="field__input"
          value={value.payment_status || ''}
          onChange={(e) => set({ payment_status: e.target.value })}
          disabled={disabled}
        >
          {PAYMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="btn btn--primary"
        onClick={applySearch}
        disabled={disabled}
      >
        Cari
      </button>
    </div>
  )
}