import { useEffect, useState } from 'react'
/* eslint-disable react-hooks/set-state-in-effect -- SWR */
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  peekCategoriesCache,
  clearCacheFor,
} from '../../../api/client'
import { resolveImageUrl, fieldError } from '../../../utils/format'
import ErrorState from '../../../components/ErrorState'
import { prefetchIdle } from '../../../prefetch/prefetch'
import { SkeletonTable } from '../../../components/Skeleton'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import ProgressBar from '../../../components/ProgressBar'
import { confirmDelete, toastError, toastSuccess } from '../../../utils/swal'

const EMPTY_FORM = {
  name: '',
  description: '',
  is_active: true,
}


function CategoryFormModal({ open, title, initial, submitting, error, fieldErrors, onSubmit, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [image, setImage] = useState(null)

  useEffect(() => {
    if (open) {
      setForm(initial || EMPTY_FORM)
      setImage(null)
    }
  }, [open, initial])

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      is_active: form.is_active,
      image: image || undefined,
    })
  }

  return (
    <Modal open={open} title={title} onClose={submitting ? undefined : onClose}>
      <form className="staff-form" onSubmit={handleSubmit}>
        <ProgressBar loading={submitting} />
        {error && <div className="alert alert--error">{error}</div>}

        <div className="field">
          <label className="field__label" htmlFor="category-name">Nama Kategori</label>
          <input
            id="category-name"
            className="field__input"
            type="text"
            required
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
          />
          {fieldError(fieldErrors, 'name') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'name')}</p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="category-description">Deskripsi</label>
          <textarea
            id="category-description"
            className="field__input staff-form__textarea"
            rows="3"
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="category-image">Gambar (opsional)</label>
          <input
            key={open ? `open-${title}` : 'closed'}
            id="category-image"
            className="field__input staff-form__file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setImage(event.target.files[0] || null)}
          />
          {fieldError(fieldErrors, 'image') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'image')}</p>
          )}
        </div>

        <label className="staff-check">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => update('is_active', event.target.checked)}
          />
          <span>Kategori aktif</span>
        </label>
        {fieldError(fieldErrors, 'is_active') && (
          <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'is_active')}</p>
        )}

        <div className="staff-form__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
            Batal
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function CategoriesPage() {
  const [search, setSearch] = useState('')
  const [draftSearch, setDraftSearch] = useState('')
  const initialCache = peekCategoriesCache({ per_page: 50 })
  const [categories, setCategories] = useState(initialCache?.items || [])
  const [loading, setLoading] = useState(!initialCache)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)

  useEffect(() => {
    let cancelled = false
    const params = search ? { search, per_page: 50 } : { per_page: 50 }
    const cached = peekCategoriesCache(params)
    const hasCached = !!cached
    if (hasCached) {
      setCategories(cached.items || [])
      setError(null)
    } else {
      setLoading(true)
    }
    const load = async () => {
      try {
        const res = await getCategories(params)
        if (cancelled) return
        const data = Array.isArray(res) ? res : res.items || []
        setCategories(data)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (!hasCached) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey, search])

  useEffect(() => {
    prefetchIdle('/admin/categories')
  }, [])

  const retry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel === 'categories') {
        clearCacheFor('/categories')
        retry()
      }
    },
  })

  const openCreate = () => {
    setEditing(null)
    setSubmitError(null)
    setFieldErrors(null)
    setModalOpen(true)
  }

  const openEdit = (category) => {
    setEditing(category)
    setSubmitError(null)
    setFieldErrors(null)
    setModalOpen(true)
  }

  const handleSubmit = async (data) => {
    setSubmitting(true)
    setSubmitError(null)
    setFieldErrors(null)
    try {
      if (editing) {
        await updateCategory(editing.id, data)
        toastSuccess('Kategori berhasil diperbarui')
      } else {
        await createCategory(data)
        toastSuccess('Kategori berhasil ditambahkan')
      }
      clearCacheFor('/categories')
      setModalOpen(false)
      setEditing(null)
      setSubmitError(null)
      setFieldErrors(null)
      retry()
    } catch (err) {
      setSubmitError(err.message)
      setFieldErrors(err.fieldErrors || null)
    } finally {
      setSubmitting(false)
    }
  }

  const requestDelete = async (category) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Kategori',
      text: `Hapus kategori "${category.name}"? Produk di dalamnya juga akan terhapus.`,
    })
    if (!confirmed) return
    try {
      await deleteCategory(category.id)
      clearCacheFor('/categories')
      retry()
      toastSuccess('Kategori berhasil dihapus')
    } catch (err) {
      toastError(err.message)
    }
  }

  const initialForm = editing
    ? {
        name: editing.name,
        description: editing.description || '',
        is_active: editing.is_active,
      }
    : EMPTY_FORM

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Kategori"
        subtitle="Kelola kategori menu. Detail kategori diambil dari daftar karena endpoint detail tidak tersedia."
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            + Tambah Kategori
          </button>
        }
      />

      {loading && <SkeletonTable rows={4} cols={3} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat kategori" message={error} onRetry={retry} />
      )}

      {!loading && !error && (
        <>
          <div className="report-toolbar order-filters">
            <label className="report-field order-filters__search">
              <span className="report-field__label">Cari</span>
              <input
                type="search"
                className="field__input"
                placeholder="Nama kategori"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setSearch(draftSearch)
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setSearch(draftSearch)}
            >
              Cari
            </button>
          </div>
          <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Deskripsi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td data-label="Kategori">
                    <div className="staff-product-cell">
                      {category.image ? (
                        <img
                          className="staff-product-cell__thumb"
                          src={resolveImageUrl(category.image)}
                          alt={category.name}
                        />
                      ) : (
                        <span className="staff-product-cell__thumb staff-product-cell__thumb--empty" aria-hidden="true" />
                      )}
                      <span>{category.name}</span>
                    </div>
                  </td>
                  <td data-label="Deskripsi">{category.description || '-'}</td>
                  <td data-label="Status">
                    {category.is_active ? (
                      <span className="staff-badge staff-badge--served">Aktif</span>
                    ) : (
                      <span className="staff-badge staff-badge--cancelled">Nonaktif</span>
                    )}
                  </td>
                  <td data-label="Aksi">
                    <div className="staff-row-actions">
                      <button
                        type="button"
                        className="btn btn--add"
                        onClick={() => openEdit(category)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--add staff-row-actions__danger"
                        onClick={() => requestDelete(category)}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      <CategoryFormModal
        key={editing ? editing.id : 'new-category'}
        open={modalOpen}
        title={editing ? 'Ubah Kategori' : 'Tambah Kategori'}
        initial={initialForm}
        submitting={submitting}
        error={submitError}
        fieldErrors={fieldErrors}
        onSubmit={handleSubmit}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
