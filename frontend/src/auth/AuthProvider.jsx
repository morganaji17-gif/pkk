/* eslint-disable react-hooks/set-state-in-effect -- inisialisasi sekali saat mount */
import { useCallback, useEffect, useState } from 'react'
import { AuthContext } from './context'
import {
  getStoredUser,
  getStoredToken,
  setStoredToken,
  setStoredUser,
  clearStoredAuth,
} from './storage'
import { loginRequest, logoutRequest, clearAllCache } from '../api/client'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const token = getStoredToken()
    const storedUser = getStoredUser()
    if (!token || !storedUser) {
      clearStoredAuth()
      clearAllCache()
      setUser(null)
    }
    setInitializing(false)
  }, [])

  const login = useCallback(async (email, password) => {
    clearAllCache()
    const data = await loginRequest({ email, password })
    setStoredToken(data.token)
    setStoredUser(data.user)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // abaikan error saat logout di server.
    } finally {
      clearStoredAuth()
      clearAllCache()
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
