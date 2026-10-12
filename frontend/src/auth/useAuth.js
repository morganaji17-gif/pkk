import { useContext } from 'react'
import { AuthContext } from './context'

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>.')
  }
  return value
}
