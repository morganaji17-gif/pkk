export default function LoadingState({ label = 'Memuat…' }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p className="state__label">{label}</p>
    </div>
  )
}
