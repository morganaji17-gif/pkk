const STATUSES = [
  { key: 'pending', label: 'Menunggu', modifier: 'pending' },
  { key: 'preparing', label: 'Dibuat', modifier: 'preparing' },
  { key: 'served', label: 'Disajikan', modifier: 'served' },
  { key: 'completed', label: 'Selesai', modifier: 'completed' },
  { key: 'cancelled', label: 'Dibatalkan', modifier: 'cancelled' },
]

export default function StatusBreakdown({ counts }) {
  return (
    <ul className="status-dots">
      {STATUSES.map((s) => {
        const count = counts?.[s.key] || 0
        return (
          <li key={s.key} className="status-dots__item">
            <span
              className={`status-dots__dot status-dots__dot--${s.modifier}${count === 0 ? ' status-dots__dot--zero' : ''}`}
              aria-hidden="true"
            />
            <span className="status-dots__label">{s.label}</span>
            <span className={`status-dots__count${count === 0 ? ' status-dots__count--zero' : ''}`}>
              {count}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
