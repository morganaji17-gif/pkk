/* eslint-disable react-hooks/set-state-in-effect -- load data when product.id changes */
import { useEffect, useState } from 'react'
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
import { formatRupiah } from '../../../utils/format'
import { toastSuccess, toastError } from '../../../utils/swal'

export default function ProductOptionsEditor({ product }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    selection_type: 'single',
    required: false,
    min_selections: 0,
    max_selections: 1,
    sort_order: '',
  })
  const [editingGroup, setEditingGroup] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [expandingGroupId, setExpandingGroupId] = useState(null)
  const [optionsByKey, setOptionsByKey] = useState({})
  const [addingOptionTo, setAddingOptionTo] = useState(null)
  const [optionForm, setOptionForm] = useState({
    label: '',
    additional_price: '',
    sort_order: '',
  })

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
    loadGroups().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  const handleCreateGroup = async () => {
    if (!createForm.name.trim()) return
    setCreating(true)
    try {
      const data = {
        name: createForm.name.trim(),
        selection_type: createForm.selection_type,
        required: createForm.required,
        min_selections: createForm.required
          ? Math.max(1, Number(createForm.min_selections) || 1)
          : (Number(createForm.min_selections) || 0),
        max_selections: createForm.selection_type === 'single' ? 1 : Number(createForm.max_selections) || null,
        sort_order: createForm.sort_order !== '' ? Number(createForm.sort_order) : undefined,
      }
      const result = await createProductOptionGroup(product.id, data)
      setGroups((prev) => [...prev, result])
      setCreateForm({
        name: '',
        selection_type: 'single',
        required: false,
        min_selections: 1,
        max_selections: 1,
        sort_order: '',
      })
      toastSuccess('Grup varian berhasil dibuat')
    } catch (err) {
      toastError(err.message || 'Gagal membuat grup varian')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateGroup = async (group) => {
    if (!editForm.name?.trim()) return
    try {
      const data = {
        name: editForm.name.trim(),
        selection_type: editForm.selection_type,
        required: editForm.required,
        min_selections: Number(editForm.min_selections) || 0,
        max_selections: editForm.selection_type === 'single' ? 1 : (editForm.max_selections !== '' ? Number(editForm.max_selections) : null),
        sort_order: editForm.sort_order !== '' ? Number(editForm.sort_order) : undefined,
      }
      const updated = await updateProductOptionGroup(product.id, group.id, data)
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
      const data = {
        label: optionForm.label.trim(),
        additional_price: Number(optionForm.additional_price) || 0,
        sort_order: optionForm.sort_order !== '' ? Number(optionForm.sort_order) : undefined,
      }
      const result = await createProductOption(product.id, group.id, data)
      setOptionsByKey((prev) => ({
        ...prev,
        [group.id]: [...(prev[group.id] || []), result],
      }))
      setAddingOptionTo(null)
      setOptionForm({ label: '', additional_price: '', sort_order: '' })
      toastSuccess('Opsi ditambahkan')
    } catch (err) {
      toastError(err.message || 'Gagal menambahkan opsi')
    }
  }

  const handleUpdateOption = async (group, option) => {
    try {
      const data = {
        label: optionForm.label.trim() || option.label,
        additional_price: Number(optionForm.additional_price) || 0,
        sort_order: optionForm.sort_order !== '' ? Number(optionForm.sort_order) : undefined,
      }
      const updated = await updateProductOption(product.id, group.id, option.id, data)
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
    <div className="product-options-editor">
      <p className="product-options-editor__intro">
        Konfigurasi opsi/varian produk. Opsi wajib harus dipilih pelanggan sebelum menambahkan ke keranjang.
      </p>

      {/* Form tambah grup */}
      <div className="product-options-editor__create-group">
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
          <option value="single">Satu pilihan</option>
          <option value="multiple">Beberapa pilihan</option>
        </select>
        <label className="product-options-editor__checkbox">
          <input
            type="checkbox"
            checked={createForm.required}
            onChange={(e) => setCreateForm((f) => ({ ...f, required: e.target.checked }))}
          />
          <span>Wajib pilih</span>
        </label>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={creating}
          onClick={handleCreateGroup}
        >
          {creating ? 'Menyimpan…' : 'Tambah Grup'}
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading && <p className="chart-empty">Memuat opsi…</p>}

      {!loading && !error && groups.length === 0 && (
        <p className="chart-empty chart-empty--compact">Belum ada varian. Tambahkan grup opsi di atas.</p>
      )}

      {groups.map((group) => (
        <div key={group.id} className="product-option-editor-group">
          <div className="product-option-editor-group__head">
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
                  <option value="single">Satu pilihan</option>
                  <option value="multiple">Beberapa pilihan</option>
                </select>
                <label className="product-options-editor__checkbox">
                  <input
                    type="checkbox"
                    checked={editForm.required}
                    onChange={(e) => setEditForm((f) => ({ ...f, required: e.target.checked }))}
                  />
                  <span>Wajib</span>
                </label>
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
                <span className={`product-option-editor-group__badge product-option-editor-group__badge--${group.selection_type}`}>
                  {group.selection_type === 'single' ? 'Satu' : 'Banyak'}
                </span>
                {group.required && (
                  <span className="product-option-editor-group__required">Wajib</span>
                )}
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setEditForm({
                      name: group.name,
                      selection_type: group.selection_type,
                      required: group.required,
                      min_selections: group.min_selections,
                      max_selections: group.max_selections,
                      sort_order: group.sort_order,
                    })
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
            <div className="product-option-editor-group__body">
              <ul className="product-option-editor-list">
                {(optionsByKey[group.id] || []).map((opt) => (
                  <li key={opt.id} className="product-option-editor-item">
                    {addingOptionTo && addingOptionTo.groupId === group.id && addingOptionTo.optionId === opt.id ? (
                      <>
                        <input
                          type="text"
                          className="field__input field__input--sm"
                          value={optionForm.label}
                          maxLength={100}
                          placeholder="Label opsi"
                          onChange={(e) => setOptionForm((f) => ({ ...f, label: e.target.value }))}
                        />
                        <input
                          type="number"
                          className="field__input field__input--sm"
                          value={optionForm.additional_price}
                          min="0"
                          step="0.01"
                          placeholder="Biaya tambahan"
                          onChange={(e) => setOptionForm((f) => ({ ...f, additional_price: e.target.value }))}
                        />
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => handleUpdateOption(group, opt)}
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
                      </>
                    ) : (
                      <>
                        <span className="product-option-editor-item__label">{opt.label}</span>
                        <span className="product-option-editor-item__price">
                          {Number(opt.additional_price) > 0 ? formatRupiah(opt.additional_price) : 'Gratis'}
                        </span>
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          onClick={() => {
                            setAddingOptionTo({ groupId: group.id, optionId: opt.id })
                            setOptionForm({
                              label: opt.label,
                              additional_price: opt.additional_price || '',
                              sort_order: opt.sort_order || '',
                            })
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
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {addingOptionTo && addingOptionTo.groupId === group.id && !addingOptionTo.optionId ? (
                <div className="product-option-editor-form">
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
                    onClick={() => handleAddOption(group)}
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
                    setAddingOptionTo({ groupId: group.id, optionId: null })
                    setOptionForm({ label: '', additional_price: '', sort_order: '' })
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
