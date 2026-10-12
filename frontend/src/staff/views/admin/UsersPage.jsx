/* eslint-disable react-hooks/set-state-in-effect -- SWR */
import { useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, deleteUser, peekUsersCache, clearCacheFor } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { fieldError } from '../../../utils/format'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import ProgressBar from '../../../components/ProgressBar'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import { confirmDelete, toastError, toastSuccess } from '../../../utils/swal'

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'cashier',
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'cashier', label: 'Kasir' },
  { value: 'kitchen', label: 'Dapur' },
]

function roleBadge(role) {
  if (role === 'admin') return <span className="staff-badge staff-badge--preparing">Admin</span>
  if (role === 'kitchen') return <span className="staff-badge staff-badge--pending">Dapur</span>
  return <span className="staff-badge staff-badge--served">Kasir</span>
}


function UserFormModal({ open, title, initial, submitting, error, fieldErrors, onSubmit, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)

  useEffect(() => {
    if (open) {
      setForm(initial || EMPTY_FORM)
    }
  }, [open, initial])
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    }
    if (!initial?.id || form.password) {
      payload.password = form.password
    }
    onSubmit(payload)
  }

  return (
    <Modal open={open} title={title} onClose={submitting ? undefined : onClose}>
      <form className="staff-form" onSubmit={handleSubmit}>
        <ProgressBar loading={submitting} />
        {error && <div className="alert alert--error">{error}</div>}

        <div className="field">
          <label className="field__label" htmlFor="user-name">Nama</label>
          <input
            id="user-name"
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
          <label className="field__label" htmlFor="user-email">Email</label>
          <input
            id="user-email"
            className="field__input"
            type="email"
            required
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
          />
          {fieldError(fieldErrors, 'email') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'email')}</p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="user-password">Kata Sandi</label>
          <input
            id="user-password"
            className="field__input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            placeholder={initial?.id ? 'Kosongkan jika tidak diubah' : ''}
            onChange={(event) => update('password', event.target.value)}
          />
          {fieldError(fieldErrors, 'password') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'password')}</p>
          )}
        </div>

        <div className="field">
          <span className="field__label">Peran</span>
          <div className="staff-form__radio">
            {ROLE_OPTIONS.map((role) => (
              <label key={role.value} className="staff-check">
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={form.role === role.value}
                  onChange={() => update('role', role.value)}
                />
                <span>{role.label}</span>
              </label>
            ))}
          </div>
          {fieldError(fieldErrors, 'role') && (
            <p className="field__hint staff-form__error">{fieldError(fieldErrors, 'role')}</p>
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

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const cachedUsers = peekUsersCache({ per_page: 50 })
  const [users, setUsers] = useState(cachedUsers?.items || [])
  const [loading, setLoading] = useState(!cachedUsers)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)

  useEffect(() => {
    let cancelled = false
    const cached = peekUsersCache({ per_page: 50 })
    const hasCached = !!cached
    if (hasCached) {
      setUsers(cached.items || [])
      setError(null)
    }
    const load = async () => {
      if (!hasCached) setLoading(true)
      try {
        const res = await getUsers({ per_page: 50 })
        if (cancelled) return
        const data = Array.isArray(res) ? res : res.items || []
        setUsers(data)
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

  const openEdit = (user) => {
    setEditing(user)
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
        await updateUser(editing.id, data)
        toastSuccess('Staf berhasil diperbarui')
      } else {
        await createUser(data)
        toastSuccess('Staf berhasil ditambahkan')
      }
      clearCacheFor('/users')
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

  const requestDelete = async (user) => {
    if (user.id === currentUser?.id) {
      toastError('Anda tidak dapat menghapus akun sendiri.')
      return
    }
    const confirmed = await confirmDelete({
      title: 'Hapus Akun',
      text: `Hapus akun "${user.name}"?`,
    })
    if (!confirmed) return
    try {
      await deleteUser(user.id)
      clearCacheFor('/users')
      retry()
      toastSuccess('Akun berhasil dihapus')
    } catch (err) {
      toastError(err.message)
    }
  }

  const initialForm = editing
    ? {
        name: editing.name,
        email: editing.email,
        password: '',
        role: editing.role,
      }
    : EMPTY_FORM

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Staf"
        subtitle="Kelola akun admin, kasir, dan dapur restoran."
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            + Tambah Staf
          </button>
        }
      />

      {loading && <SkeletonTable rows={4} cols={4} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat staf" message={error} onRetry={retry} />
      )}

      {!loading && !error && (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Nama">
                    {user.name}
                    {user.id === currentUser?.id && (
                      <span className="staff-badge staff-badge--served staff-user__me">Anda</span>
                    )}
                  </td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Peran">
                    {roleBadge(user.role)}
                  </td>
                  <td data-label="Aksi">
                    <div className="staff-row-actions">
                      <button
                        type="button"
                        className="btn btn--add"
                        onClick={() => openEdit(user)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--add staff-row-actions__danger"
                        disabled={user.id === currentUser?.id}
                        onClick={() => requestDelete(user)}
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

      <UserFormModal
        key={editing ? editing.id : 'new-user'}
        open={modalOpen}
        title={editing ? 'Ubah Staf' : 'Tambah Staf'}
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