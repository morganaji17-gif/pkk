export default function ProgressBar({ loading }) {
  if (!loading) return null
  return (
    <div className="progress-bar" role="progressbar" aria-label="Memuat">
      <div className="progress-bar__fill" />
    </div>
  )
}
