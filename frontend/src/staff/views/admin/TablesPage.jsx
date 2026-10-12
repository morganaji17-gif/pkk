import { useEffect, useState } from 'react'
/* eslint-disable react-hooks/set-state-in-effect -- SWR cache as initial state */
import {
  getRestaurantTables,
  getRestaurantTableQrUrl,
  createRestaurantTable,
  updateRestaurantTable,
  updateRestaurantTableStatus,
  deleteRestaurantTable,
  peekTablesCache,
  clearCacheFor,
} from '../../../api/client'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import ProgressBar from '../../../components/ProgressBar'
import TableStatusBadge from '../../components/TableStatusBadge'
import { fieldError } from '../../../utils/format'
import { useStaffRealtime } from '../../hooks/useStaffRealtime'
import { confirmDelete, toastError, toastSuccess } from '../../../utils/swal'
import { prefetchIdle } from '../../../prefetch/prefetch'

const EMPTY_FORM = {
  table_number: '',
  capacity: '',
  qr_code: '',
  status: 'available',
}


function TableFormModal({ open, title, initial, submitting, error, fieldErrors, onSubmit, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)

  useEffect(() => {
    if (open) {
      setForm(initial || EMPTY_FORM)
    }
  }, [open, initial])

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit({
      table_number: form.table_number.trim(),
      capacity: Number(form.capacity),
      qr_code: form.qr_code.trim(),
      status: form.status,
    })
  }

  return (
    <Modal open={open} title={title} onClose={submitting ? undefined : onClose}>
      <form className="staff-form" onSubmit={handleSubmit}>
        <ProgressBar loading={submitting} />
        {error && <div className="alert alert--error">{error}</div>}

        <div className="field">
          <label className="field__label" htmlFor="table-number">Nomor Meja</label>
          <input
            id="table-number"
            className="field__input"
            type="text"
            required
            value={form.table_number}
            onChange={(event) => update('table_number', event.target.value)}
            placeholder="contoh: 1 atau A1"
          />
          {fieldError(fieldErrors, 'table_number') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'table_number')}</p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="table-capacity">Kapasitas (orang)</label>
          <input
            id="table-capacity"
            className="field__input"
            type="number"
            min="1"
            required
            value={form.capacity}
            onChange={(event) => update('capacity', event.target.value)}
          />
          {fieldError(fieldErrors, 'capacity') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'capacity')}</p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="table-qr">Kode QR (opsional)</label>
          <input
            id="table-qr"
            className="field__input"
            type="text"
            value={form.qr_code}
            onChange={(event) => update('qr_code', event.target.value)}
            placeholder="nilai kode QR"
          />
          {fieldError(fieldErrors, 'qr_code') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'qr_code')}</p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="table-status">Status</label>
          <select
            id="table-status"
            className="field__input"
            value={form.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="available">Tersedia</option>
            <option value="maintenance">Tidak Tersedia</option>
          </select>
          {fieldError(fieldErrors, 'status') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'status')}</p>
          )}
        </div>

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

export default function TablesPage() {
  const initialCache = peekTablesCache({ per_page: 50 })
  const [tables, setTables] = useState(initialCache?.items || [])
  const [loading, setLoading] = useState(!initialCache)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)

  const [qrTable, setQrTable] = useState(null)

  useEffect(() => {
    let cancelled = false
    const cached = peekTablesCache({ per_page: 50 })
    const hasCached = !!cached
    if (hasCached) {
      setTables(cached.items || [])
      setError(null)
    } else {
      setLoading(true)
    }
    const load = async () => {
      try {
        const res = await getRestaurantTables({ per_page: 50 })
        if (cancelled) return
        const data = Array.isArray(res) ? res : res.items || []
        setTables(data)
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
  }, [reloadKey])

  useEffect(() => {
    prefetchIdle('/admin/tables')
  }, [])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel === 'tables') setReloadKey((n) => n + 1)
    },
  })

  const retry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }

  const openCreate = () => {
    setEditing(null)
    setSubmitError(null)
    setFieldErrors(null)
    setModalOpen(true)
  }

  const openEdit = (table) => {
    setEditing(table)
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
        await updateRestaurantTable(editing.id, data)
        toastSuccess('Meja berhasil diperbarui')
      } else {
        await createRestaurantTable(data)
        toastSuccess('Meja berhasil ditambahkan')
      }
      clearCacheFor('/restaurant-tables')
      clearCacheFor('/tables')
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

  const requestDelete = async (table) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Meja',
      text: `Hapus meja "${table.table_number}"?`,
    })
    if (!confirmed) return
    try {
      await deleteRestaurantTable(table.id)
      clearCacheFor('/restaurant-tables')
      clearCacheFor('/tables')
      retry()
      toastSuccess('Meja berhasil dihapus')
    } catch (err) {
      toastError(err.message)
    }
  }

  const initialForm = editing
    ? {
        table_number: editing.table_number,
        capacity: editing.capacity,
        qr_code: editing.qr_code || '',
        status: editing.status || (editing.is_available ? 'available' : 'maintenance'),
      }
    : EMPTY_FORM

  const handleQuickStatus = async (table, nextStatus) => {
    try {
      await updateRestaurantTableStatus(table.id, nextStatus)
      clearCacheFor('/restaurant-tables')
      clearCacheFor('/tables')
      retry()
      toastSuccess(`Meja ${table.table_number} ditandai ${nextStatus === 'available' ? 'tersedia' : 'tidak tersedia'}`)
    } catch (err) {
      toastError(err.message)
    }
  }

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Meja"
        subtitle="Kelola meja restoran."
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            + Tambah Meja
          </button>
        }
      />

      {loading && <SkeletonTable rows={5} cols={4} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat meja" message={error} onRetry={retry} />
      )}

      {!loading && !error && (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Meja</th>
                <th>Kapasitas</th>
                <th>Kode QR</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id}>
                  <td className="staff-table__total" data-label="Meja">Meja {table.table_number}</td>
                  <td data-label="Kapasitas">{table.capacity} orang</td>
                  <td data-label="Kode QR">
                    <button
                      type="button"
                      className="staff-qr"
                      onClick={() => setQrTable(table)}
                      title={`Perbesar QR Meja ${table.table_number}`}
                    >
                      <img
                        className="staff-qr__thumb"
                        src={getRestaurantTableQrUrl(table.id)}
                        alt={`QR Meja ${table.table_number}`}
                      />
                    </button>
                  </td>
                  <td data-label="Status">
                    <TableStatusBadge status={table.effective_status} />
                    <button
                      type="button"
                      className="btn btn--add staff-status-toggle"
                      onClick={() =>
                        handleQuickStatus(
                          table,
                          table.status === 'maintenance' ? 'available' : 'maintenance'
                        )
                      }
                      title={
                        table.status === 'maintenance'
                          ? 'Tandai meja tersedia'
                          : 'Tandai meja tidak tersedia'
                      }
                    >
                      {table.status === 'maintenance' ? 'Tandai Tersedia' : 'Tandai Tidak Tersedia'}
                    </button>
                  </td>
                  <td data-label="Aksi">
                    <div className="staff-row-actions">
                      <button
                        type="button"
                        className="btn btn--add"
                        onClick={() => openEdit(table)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--add staff-row-actions__danger"
                        onClick={() => requestDelete(table)}
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
      )}

      <TableFormModal
        key={editing ? editing.id : 'new-table'}
        open={modalOpen}
        title={editing ? 'Ubah Meja' : 'Tambah Meja'}
        initial={initialForm}
        submitting={submitting}
        error={submitError}
        fieldErrors={fieldErrors}
        onSubmit={handleSubmit}
        onClose={() => setModalOpen(false)}
      />

      <Modal
        open={Boolean(qrTable)}
        title={qrTable ? `Kode QR Meja ${qrTable.table_number}` : 'Kode QR'}
        onClose={() => setQrTable(null)}
      >
        <div className="staff-qr-modal">
          {qrTable && (
            <img
              className="staff-qr-modal__img"
              src={getRestaurantTableQrUrl(qrTable.id)}
              alt={`QR Meja ${qrTable.table_number}`}
            />
          )}
          <p className="staff-qr-modal__url">
            {qrTable ? `${window.location.origin}/menu?table=${qrTable.id}` : ''}
          </p>
          <p className="staff-qr-modal__hint">
            Pindai QR ini untuk membuka menu di meja tersebut.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setQrTable(null)}
          >
            Tutup
          </button>
        </div>
      </Modal>
    </div>
  )
}
