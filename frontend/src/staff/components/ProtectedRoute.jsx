import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import LoadingState from '../../components/LoadingState'

function AccessDenied({ roles, role }) {
  const allowed = roles || (role ? [role] : [])
  const destination = allowed.includes('admin')
    ? '/admin'
    : allowed.includes('cashier')
      ? '/cashier'
      : allowed.includes('kitchen')
        ? '/kitchen'
        : '/menu'
  const label = allowed.join(', ') || role || 'staf'
  return (
    <div className="state" role="alert">
      <div className="state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="state__title">Akses Ditolak</h2>
      <p className="state__label">
        Halaman ini hanya tersedia untuk akun {label}. Silakan kembali ke
        dashboard Anda.
      </p>
      <Link to={destination} className="btn btn--primary">
        Ke Dashboard
      </Link>
    </div>
  )
}

export default function ProtectedRoute({ role, roles, children }) {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return <LoadingState label="Memeriksa sesi Anda…" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const allowed = roles || (role ? [role] : null)
  if (allowed && !allowed.includes(user.role)) {
    return <AccessDenied roles={allowed} role={role} />
  }

  return children
}
