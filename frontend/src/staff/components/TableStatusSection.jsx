import { useEffect, useState } from 'react'
import { getRestaurantTables, updateRestaurantTableStatus } from '../../api/client'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import TableStatusBadge from './TableStatusBadge'
import { toastError, toastSuccess } from '../../utils/swal'
import { useStaffRealtime } from '../hooks/useStaffRealtime'

export default function TableStatusSection() {
  const [tables, setTables] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await getRestaurantTables({ per_page: 50 })
        if (cancelled) return
        const data = Array.isArray(res) ? res : res.items || []
        setTables(data)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel === 'tables') setReloadKey((n) => n + 1)
    },
  })

  const toggle = async (table, nextStatus) => {
    try {
      await updateRestaurantTableStatus(table.id, nextStatus)
      setReloadKey((n) => n + 1)
      toastSuccess(
        `Meja ${table.table_number} ditandai ${nextStatus === 'available' ? 'tersedia' : 'tidak tersedia'}`
      )
    } catch (err) {
      toastError(err.message)
    }
  }

  const retry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }

  if (loading && !tables) {
    return <LoadingState label="Memuat status meja…" />
  }

  if (error && !tables) {
    return <ErrorState title="Gagal memuat meja" message={error} onRetry={retry} />
  }

  if (!tables || tables.length === 0) return null

  return (
    <section className="table-status">
      <div className="table-status__head">
        <h2 className="table-status__title">Status Meja</h2>
        <p className="table-status__hint">
          Status 'Terisi' otomatis dari pesanan aktif. Ubah 'Tersedia' / 'Tidak Tersedia' di sini.
        </p>
      </div>
      <div className="table-status__grid">
        {tables.map((table) => {
          const status = table.effective_status
          return (
            <div key={table.id} className={`table-status-card table-status-card--${status}`}>
              <div className="table-status-card__top">
                <span className="table-status-card__number">Meja {table.table_number}</span>
                <TableStatusBadge status={status} />
              </div>
              <span className="table-status-card__meta">{table.capacity} orang</span>
              <div className="table-status-card__actions">
                <button
                  type="button"
                  className="btn btn--add"
                  disabled={status === 'available' || status === 'occupied'}
                  onClick={() => toggle(table, 'available')}
                >
                  Tersedia
                </button>
                <button
                  type="button"
                  className="btn btn--add"
                  disabled={status === 'maintenance'}
                  onClick={() => toggle(table, 'maintenance')}
                >
                  Tidak Tersedia
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}