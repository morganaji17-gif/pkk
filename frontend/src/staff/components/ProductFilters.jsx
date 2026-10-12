import { useState } from 'react'

export default function ProductFilters({ value, onChange, categories = [], disabled }) {
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
          placeholder="Nama produk"
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
        <span className="report-field__label">Kategori</span>
        <select
          className="field__input"
          value={value.category_id || ''}
          onChange={(e) => set({ category_id: e.target.value })}
          disabled={disabled}
        >
          <option value="">Semua</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
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