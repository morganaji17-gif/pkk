const LABELS = {
  pending: 'Menunggu',
  confirmed: 'Diterima',
  preparing: 'Disiapkan',
  served: 'Siap',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

export default function StatusBadge({ status }) {
  const label = LABELS[status] || status || '-'
  return (
    <span className={`staff-badge staff-badge--${status || 'unknown'}`}>
      {label}
    </span>
  )
}
