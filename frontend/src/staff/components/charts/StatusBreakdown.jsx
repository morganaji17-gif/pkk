const STATUSES = [
  { key: 'pending', label: 'Menunggu', modifier: 'pending' },
  { key: 'confirmed', label: 'Diterima', modifier: 'confirmed' },
  { key: 'preparing', label: 'Dibuat', modifier: 'preparing' },
  { key: 'served', label: 'Disajikan', modifier: 'served' },
  { key: 'completed', label: 'Selesai', modifier: 'completed' },
  { key: 'cancelled', label: 'Dibatalkan', modifier: 'cancelled' },
]

export default function StatusBreakdown({ counts }) {
  const maxCount = Math.max(...STATUSES.map((s) => counts?.[s.key] || 0), 1)

  return (
    <ul className="status-dots">
      {STATUSES.map((s) => {
        const count = counts?.[s.key] || 0
        const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
        return (
          <li key={s.key} className="status-dots__item">
            <span className="status-dots__label">{s.label}</span>
            <div className="status-dots__bar-wrap">
              <div
                className={`status-dots__bar status-dots__bar--${s.modifier}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`status-dots__count${count === 0 ? ' status-dots__count--zero' : ''}`}>
              {count}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
