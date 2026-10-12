export default function ErrorState({ title = 'Terjadi kesalahan', message, onRetry }) {
  return (
    <div className="state" role="alert">
      <div className="state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="state__title">{title}</h2>
      {message && <p className="state__label">{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn--primary btn--block" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  )
}
