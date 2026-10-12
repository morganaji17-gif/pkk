import { tableStatusInfo } from '../utils/tableStatus'

export default function TableBanner({ table }) {
  const status = table.effective_status || (table.is_available ? 'available' : 'maintenance')
  const statusInfo = tableStatusInfo(status)

  return (
    <header className="table-banner">
      <div className="table-banner__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
          <path d="M5 12v7h14v-7" />
          <path d="M10 19v-3a2 2 0 0 1 4 0v3" />
        </svg>
      </div>
      <div className="table-banner__body">
        <p className="table-banner__eyebrow">Scan berhasil — Anda berada di</p>
        <h1 className="table-banner__number">Meja {table.table_number}</h1>
        {table.capacity ? (
          <p className="table-banner__meta">Kapasitas {table.capacity} orang</p>
        ) : null}
      </div>
      <span className={`table-banner__status table-banner__status--${status}`}>
        {statusInfo.label}
      </span>
    </header>
  )
}
