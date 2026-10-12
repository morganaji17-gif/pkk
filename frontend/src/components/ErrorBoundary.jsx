import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="state" role="alert">
          <h2 className="state__title">Terjadi kesalahan</h2>
          <p className="state__label">
            {this.state.error?.message || 'Gagal memuat halaman. Silakan refresh.'}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Coba lagi
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
