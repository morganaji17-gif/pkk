export function Skeleton({ className = '', style }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <Skeleton className="skeleton-card__img" />
      <Skeleton style={{ width: '78%' }} />
      <Skeleton style={{ width: '58%' }} />
    </div>
  )
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="skeleton-grid" role="status" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
      <span className="sr-only">Memuat…</span>
    </div>
  )
}

export function SkeletonTable({ rows = 6, cols = 4 }) {
  return (
    <div className="skeleton-table" role="status" aria-live="polite">
      <Skeleton className="skeleton-table__head" />
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="skeleton-table__row" aria-hidden="true">
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} style={{ width: `${65 + ((row + col) % 3) * 12}%` }} />
          ))}
        </div>
      ))}
      <span className="sr-only">Memuat…</span>
    </div>
  )
}

export function SkeletonCards({ count = 5 }) {
  return (
    <div className="skeleton-cards" role="status" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="skeleton-cards__item" />
      ))}
      <span className="sr-only">Memuat…</span>
    </div>
  )
}