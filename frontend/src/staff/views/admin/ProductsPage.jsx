/* eslint-disable react-hooks/set-state-in-effect -- SWR */
import { useEffect, useState } from 'react'
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  peekProductsCache,
  peekCategoriesCache,
  clearCacheFor,
} from '../../../api/client'
import { resolveImageUrl, formatRupiah, fieldError } from '../../../utils/format'
import { stockStatusLabel, stockStatusClass } from '../../../utils/stock'
import { prefetchIdle } from '../../../prefetch/prefetch'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import ProgressBar from '../../../components/ProgressBar'
import ProductFilters from '../../components/ProductFilters'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import { confirmDelete, toastError, toastSuccess } from '../../../utils/swal'

const EMPTY_FORM = {
  category_id: '',
  name: '',
  description: '',
  price: '',
  cost_price: '',
  stock: '',
  is_active: true,
}


function ProductFormModal({ open, title, categories, initial, submitting, error, fieldErrors, onSubmit, onClose }) {
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
      category_id: Number(form.category_id),
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      cost_price: form.cost_price === '' ? null : Number(form.cost_price),
      stock: Number(form.stock),
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
          <label className="field__label" htmlFor="product-category">Kategori</label>
          <select
            id="product-category"
            className="field__input"
            required
            value={form.category_id}
            onChange={(event) => update('category_id', event.target.value)}
          >
            <option value="">Pilih kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {fieldError(fieldErrors, 'category_id') && (
            <p className="field__hint staff-form__error">
              {fieldError(fieldErrors, 'category_id')}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="product-name">Nama Produk</label>
          <input
            id="product-name"
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
          <label className="field__label" htmlFor="product-description">Deskripsi</label>
          <textarea
            id="product-description"
            className="field__input staff-form__textarea"
            rows="3"
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
        </div>

        <div className="staff-form__row">
          <div className="field">
            <label className="field__label" htmlFor="product-price">Harga</label>
            <input
              id="product-price"
              className="field__input"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price}
              onChange={(event) => update('price', event.target.value)}
            />
            {fieldError(fieldErrors, 'price') && (
              <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'price')}</p>
            )}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="product-cost-price">HPP</label>
            <input
              id="product-cost-price"
              className="field__input"
              type="number"
              min="0"
              step="0.01"
              value={form.cost_price}
              placeholder="Opsional"
              onChange={(event) => update('cost_price', event.target.value)}
            />
            {fieldError(fieldErrors, 'cost_price') && (
              <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'cost_price')}</p>
            )}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="product-stock">Stok</label>
            <input
              id="product-stock"
              className="field__input"
              type="number"
              min="0"
              required
              value={form.stock}
              onChange={(event) => update('stock', event.target.value)}
            />
            {fieldError(fieldErrors, 'stock') && (
              <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'stock')}</p>
            )}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="product-image">Gambar (opsional)</label>
          <input
            key={open ? `open-${title}` : 'closed'}
            id="product-image"
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
          <span>Produk aktif</span>
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

export default function ProductsPage() {
  const initialProductsCache = peekProductsCache({ per_page: 50 })
  const initialCategoriesCache = peekCategoriesCache({ per_page: 50 })
  const [products, setProducts] = useState(initialProductsCache?.items || [])
  const [categories, setCategories] = useState(initialCategoriesCache?.items || [])
  const [loading, setLoading] = useState(!initialProductsCache)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState({ search: '', category_id: '' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)

  useEffect(() => {
    let cancelled = false
    const cached = peekProductsCache({ ...filters, per_page: 50 })
    const hasCached = !!cached
    if (hasCached) {
      setProducts(cached.items || [])
      setError(null)
    } else {
      setLoading(true)
    }
    const load = async () => {
      try {
        const [productRes, categoryRes] = await Promise.all([
          getProducts({ ...filters, per_page: 50 }),
          getCategories({ per_page: 50 }).catch(() => ({ items: [] })),
        ])
        if (cancelled) return
        const productData = Array.isArray(productRes) ? productRes : productRes.items || []
        const categoryData = Array.isArray(categoryRes) ? categoryRes : categoryRes.items || []
        setProducts(productData)
        setCategories(categoryData)
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
  }, [reloadKey, filters])

  const retry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }

  useEffect(() => {
    prefetchIdle('/admin/products')
  }, [])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel === 'products') {
        clearCacheFor('/products')
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

  const openEdit = (product) => {
    setEditing(product)
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
        await updateProduct(editing.id, data)
        toastSuccess('Produk berhasil diperbarui')
      } else {
        await createProduct(data)
        toastSuccess('Produk berhasil ditambahkan')
      }
      clearCacheFor('/products')
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

  const requestDelete = async (product) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Produk',
      text: `Hapus produk "${product.name}"? Tindakan ini tidak dapat dibatalkan.`,
    })
    if (!confirmed) return
    try {
      await deleteProduct(product.id)
      clearCacheFor('/products')
      retry()
      toastSuccess('Produk berhasil dihapus')
    } catch (err) {
      toastError(err.message)
    }
  }

  const initialForm = editing
    ? {
        category_id: editing.category_id,
        name: editing.name,
        description: editing.description || '',
        price: editing.price,
        cost_price: editing.cost_price ?? '',
        stock: editing.stock,
        is_active: editing.is_active,
      }
    : EMPTY_FORM

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Produk"
        subtitle="Kelola daftar menu produk."
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            + Tambah Produk
          </button>
        }
      />

      {loading && <SkeletonTable rows={6} cols={5} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat produk" message={error} onRetry={retry} />
      )}

      {!loading && !error && (
        <>
          <ProductFilters
            value={filters}
            onChange={setFilters}
            categories={categories}
          />
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Harga</th>
                  <th>Stok</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td data-label="Produk">
                    <div className="staff-product-cell">
                      {product.image ? (
                        <img
                          className="staff-product-cell__thumb"
                          src={resolveImageUrl(product.image)}
                          alt={product.name}
                        />
                      ) : (
                        <span className="staff-product-cell__thumb staff-product-cell__thumb--empty" aria-hidden="true" />
                      )}
                      <span>{product.name}</span>
                    </div>
                  </td>
                  <td data-label="Kategori">{product.category?.name || '-'}</td>
                  <td className="staff-table__total" data-label="Harga">{formatRupiah(product.price)}</td>
                  <td data-label="Stok">
                    <div className="staff-stock-cell">
                      <span>{product.stock}</span>
                      {product.stock_status !== 'normal' && (
                        <span className={`staff-badge stock-badge ${stockStatusClass(product.stock_status)}`}>
                          {stockStatusLabel(product.stock_status)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Status">
                    {product.is_active ? (
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
                        onClick={() => openEdit(product)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--add staff-row-actions__danger"
                        onClick={() => requestDelete(product)}
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

      <ProductFormModal
        key={editing ? editing.id : 'new-product'}
        open={modalOpen}
        title={editing ? 'Ubah Produk' : 'Tambah Produk'}
        categories={categories}
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
