import { useCallback, useEffect, useRef, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import ErrorState from '../../../components/ErrorState'
import { SkeletonTable } from '../../../components/Skeleton'
import { getAuditLogs, peekAuditLogsCache } from '../../../api/client'
import { formatDateTime } from '../../../utils/format'

export default function AuditLogsPage() {
  const initialCache = peekAuditLogsCache({ page: 1, per_page: 15 })
  const [logs, setLogs] = useState(initialCache?.data || [])
  const [meta, setMeta] = useState(initialCache?.meta || {})
  const [loading, setLoading] = useState(!initialCache)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const inFlight = useRef(false)

  const load = useCallback(async (nextPage, q) => {
    if (inFlight.current) return
    inFlight.current = true
    if (nextPage === 1) setLoading(true)
    try {
      const result = await getAuditLogs({ page: nextPage, per_page: 15, search: q })
      if (nextPage === 1) {
        setLogs(result.data)
      } else {
        setLogs((prev) => [...prev, ...result.data])
      }
      setMeta(result.meta)
      setError(null)
    } catch (err) {
      if (nextPage === 1) setError(err.message)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(1, search.trim()), 0)
    return () => clearTimeout(timer)
  }, [search, load])

  const loadMore = () => {
    if (!meta?.has_more) return
    setLoadingMore(true)
    load(page + 1, search.trim())
      .then(() => setPage((p) => p + 1))
      .finally(() => setLoadingMore(false))
  }

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Log Audit"
        subtitle="Riwayat aktivitas staf dan perubahan data penting."
      />

      <div className="staff-toolbar">
        <label className="report-field order-filters__search">
          <span className="report-field__label">Cari</span>
          <input
            type="search"
            className="field__input"
            placeholder="Cari deskripsi log…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </label>
      </div>

      {loading && <SkeletonTable rows={8} cols={5} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat log" message={error} onRetry={() => load(1, search)} />
      )}

      {!loading && !error && (
        <>
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Staf</th>
                  <th>Aksi</th>
                  <th>Deskripsi</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="staff-table__empty">
                      Belum ada log audit.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td data-label="Waktu">{formatDateTime(log.created_at)}</td>
                    <td data-label="Staf">{log.user?.name || 'Sistem'}</td>
                    <td data-label="Aksi">
                      <span className="staff-badge">{log.action}</span>
                    </td>
                    <td data-label="Deskripsi">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta?.has_more && (
            <div className="staff-loadmore">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Memuat…' : 'Muat Lebih Banyak'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}