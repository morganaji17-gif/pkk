import { useState } from 'react'
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../api/client'

function destinationForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'kitchen') return '/kitchen'
  return '/cashier'
}

export default function LoginView() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (user) {
    return <Navigate to={destinationForRole(user.role)} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedInUser = await login(email.trim(), password)
      const fallback = destinationForRole(loggedInUser.role)
      const from = location.state?.from?.pathname
      navigate(from && from.startsWith(`/${loggedInUser.role}`) ? from : fallback, {
        replace: true,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Email atau password salah.')
      } else {
        setError(err.message || 'Gagal masuk. Silakan coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="staff-login">
      <div className="staff-login__card">
        <div className="staff-login__brand">
          <span className="staff-login__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
              <path d="M4 2h16" />
              <path d="M6 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2" />
              <path d="M9 16v4" />
              <path d="M15 16v4" />
              <path d="M8 22h8" />
            </svg>
          </span>
          <h1 className="staff-login__title">Pesanin</h1>
          <p className="staff-login__subtitle">Masuk untuk staf restoran</p>
        </div>

        <form className="staff-login__form" onSubmit={handleSubmit}>
          {error && <div className="alert alert--error">{error}</div>}

          <div className="field">
            <label className="field__label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="field__input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@contoh.com"
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="field__input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={submitting}
          >
            {submitting ? 'Memproses…' : 'Masuk'}
          </button>
        </form>

        <Link to="/menu" className="staff-login__menu-link">
          Lihat menu customer
        </Link>
      </div>
    </div>
  )
}
