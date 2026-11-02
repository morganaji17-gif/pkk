import { useEffect, useState } from 'react'
import { formatRupiah } from '../../../utils/format'
import { toastError, toastSuccess } from '../../../utils/swal'
import {
  getProductOptionGroups,
  createProductOptionGroup,
  updateProductOptionGroup,
  deleteProductOptionGroup,
  getProductOptions,
  createProductOption,
  updateProductOption,
  deleteProductOption,
} from '../../../api/client'

export default function ProductOptionGroupsPanel({ product }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', selection_type: 'single' })
  const [editingGroup, setEditingGroup] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', selection_type: 'single' })
  const [expandingGroupId, setExpandingGroupId] = useState(null)
  const [optionsByKey, setOptionsByKey] = useState({})
  const [addingOptionTo, setAddingOptionTo] = useState(null)
  const [optionForm, setOptionForm] = useState({ label: '', additional_price: '' })

  const loadGroups = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProductOptionGroups(product.id)
      setGroups(data || [])
    } catch (err) {
      setError(err.message || 'Gagal memuat opsi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [product.id])

  const handleCreateGroup = async () => {
    if (!createForm.name.trim()) return
    setCreating(true)
    try {
      const data = await createProductOptionGroup(product.id, {
        name: createForm.name.trim(),
        selection_type: createForm.selection_type,
      })
      setGroups((prev) => [...prev, data])
      setCreateForm({ name: '', selection_type: 'single' })
      toastSuccess('Grup varian berhasil dibuat')
    } catch (err) {
      toastError(err.message || 'Gagal membuat grup varian')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateGroup = async (group) => {
    if (!editForm.name.trim()) return
    try {
      const updated = await updateProductOptionGroup(product.id, group.id, editForm)
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)))
      setEditingGroup(null)
      toastSuccess('Grup varian diperbarui')
    } catch (err) {
      toastError(err.message || 'Gagal memperbarui grup')
    }
  }

  const handleDeleteGroup = async (group) => {
    try {
      await deleteProductOptionGroup(product.id, group.id)
      setGroups((prev) => prev.filter((g) => g.id !== group.id))
      setOptionsByKey((prev) => {
        const next = { ...prev }
        delete next[group.id]
        return next
      })
      toastSuccess('Grup varian dihapus')
    } catch (err) {
      toastError(err.message || 'Gagal menghapus grup varian')
    }
  }

  const toggleExpand = async (groupId) => {
    if (expandingGroupId === groupId) {
      setExpandingGroupId(null)
      return
    }
    if (optionsByKey[groupId]) {
      setExpandingGroupId(groupId)
      return
    }
    try {
      const data = await getProductOptions(product.id, groupId)
      setOptionsByKey((prev) => ({ ...prev, [groupId]: data || [] }))
      setExpandingGroupId(groupId)
    } catch {
      toastError('Gagal memuat opsi')
    }
  }

  const handleAddOption = async (group) => {
    if (!optionForm.label.trim() || Number(optionForm.additional_price) < 0) return
    try {
      const data = await createProductOption(product.id, group.id, {
        label: optionForm.label.trim(),
        additional_price: Number(optionForm.additional_price) || 0,
      })
      setOptionsByKey((prev) => ({
        ...prev,
        [group.id]: [...(prev[group.id] || []), data],
      }))
      setAddingOptionTo(null)
      setOptionForm({ label: '', additional_price: '' })
      toastSuccess('Opsi ditambahkan')
    } catch (err) {
      toastError(err.message || 'Gagal menambahkan opsi')
    }
  }

  const handleUpdateOption = async (group, option) => {
    try {
      const updated = await updateProductOption(product.id, group.id, option.id, {
        label: optionForm.label.trim() || option.label,
        additional_price: Number(optionForm.additional_price) || 0,
      })
      setOptionsByKey((prev) => ({
        ...prev,
        [group.id]: (prev[group.id] || []).map((o) => (o.id === option.id ? updated : o)),
      }))
      setAddingOptionTo(null)
      toastSuccess('Opsi diperbarui')
    } catch (err) {
      toastError(err.message || 'Gagal memperbarui opsi')
    }
  }

  const handleDeleteOption = async (group, option) => {
    try {
      await deleteProductOption(product.id, group.id, option.id)
      setOptionsByKey((prev) => ({
        ...prev,
        [group.id]: (prev[group.id] || []).filter((o) => o.id !== option.id),
      }))
      toastSuccess('Opsi dihapus')
    } catch (err) {
      toastError(err.message || 'Gagal menghapus opsi')
    }
  }

  return (
    <div className="product-option-panel">
      <p className="product-option-panel__intro">
        Tambahkan varian/opsi (contoh: Level Pedas, Ukuran). Harga akan ditambahkan otomatis ke harga dasar.
      </p>

      {/* Form tambah grup */}
      <div className="product-option-panel__create-group">
        <input
          type="text"
          className="field__input field__input--sm"
          placeholder="Nama grup (mis. Level Pedas)"
          value={createForm.name}
          maxLength={100}
          onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
        />
        <select
          className="field__input field__input--sm"
          value={createForm.selection_type}
          onChange={(e) => setCreateForm((f) => ({ ...f, selection_type: e.target.value }))}
        >
          <option value="single">Pilih satu</option>
          <option value="multiple">Bebas banyak</option>
        </select>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={creating}
          onClick={handleCreateGroup}
        >
          {creating ? 'Simpan…' : 'Tambah Grup'}
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading && <p className="chart-empty">Memuat varian…</p>}

      {!loading && !error && groups.length === 0 && (
        <p className="chart-empty chart-empty--compact">Belum ada varian.</p>
      )}

      {groups.map((group) => (
        <div key={group.id} className="product-option-group">
          <div className="product-option-group__head">
            {editingGroup === group.id ? (
              <>
                <input
                  type="text"
                  className="field__input field__input--sm"
                  value={editForm.name}
                  maxLength={100}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
                <select
                  className="field__input field__input--sm"
                  value={editForm.selection_type}
                  onChange={(e) => setEditForm((f) => ({ ...f, selection_type: e.target.value }))}
                >
                  <option value="single">Pilih satu</option>
                  <option value="multiple">Bebas banyak</option>
                </select>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => handleUpdateGroup(group)}
                >
                  Simpan
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setEditingGroup(null)}
                >
                  Batal
                </button>
              </>
            ) : (
              <>
                <strong>{group.name}</strong>
                <span className={`product-option-group__badge product-option-group__badge--${group.selection_type}`}>
                  {group.selection_type === 'single' ? 'Satu' : 'Beberapa'}
                </span>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setEditForm({ name: group.name, selection_type: group.selection_type })
                    setEditingGroup(group.id)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => toggleExpand(group.id)}
                >
                  {expandingGroupId === group.id ? 'Sembunyikan' : 'Kelola'}
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => handleDeleteGroup(group)}
                >
                  Hapus
                </button>
              </>
            )}
          </div>

          {expandingGroupId === group.id && (
            <div className="product-option-group__body">
              <ul className="product-options-list">
                {(optionsByKey[group.id] || []).map((opt) => (
                  <li key={opt.id} className="product-option-item">
                    <span className="product-option-item__label">{opt.label}</span>
                    <span className="product-option-item__price">
                      {Number(opt.additional_price) > 0 ? formatRupiah(opt.additional_price) : 'Gratis'}
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => {
                        setAddingOptionTo({ groupId: group.id, optionId: opt.id, isEditing: true })
                        setOptionForm({ label: opt.label, additional_price: opt.additional_price || '' })
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost btn--danger"
                      onClick={() => handleDeleteOption(group, opt)}
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
              {addingOptionTo && addingOptionTo.groupId === group.id ? (
                <div className="product-option-item__form">
                  <input
                    type="text"
                    className="field__input field__input--sm"
                    placeholder="Label (mis. Level 5)"
                    value={optionForm.label}
                    maxLength={100}
                    onChange={(e) => setOptionForm((f) => ({ ...f, label: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="field__input field__input--sm"
                    placeholder="Tambahan harga (opsional)"
                    min="0"
                    step="0.01"
                    value={optionForm.additional_price}
                    onChange={(e) => setOptionForm((f) => ({ ...f, additional_price: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => {
                      if (addingOptionTo.isEditing) {
                        handleUpdateOption(groups.find((g) => g.id === group.id), { id: addingOptionTo.optionId })
                      } else {
                        handleAddOption(groups.find((g) => g.id === group.id))
                      }
                    }}
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setAddingOptionTo(null)}
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    setAddingOptionTo({ groupId: group.id, optionId: null, isEditing: false })
                    setOptionForm({ label: '', additional_price: '' })
                  }}
                >
                  + Tambah Opsi
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
