/* eslint-disable react-refresh/only-export-components -- provider + hook shared */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { getStaffStreamUrl } from '../../api/client'
import { getStoredToken } from '../../auth/storage'
import { useAuth } from '../../auth/useAuth'
import { useRealtimePoll } from '../../hooks/useRealtimePoll'

const RealtimeContext = createContext({ subscribe: () => () => {} })

export function RealtimeProvider({ children }) {
  const { user } = useAuth()
  const token = user ? getStoredToken() : null
  const subscribersRef = useRef(new Set())
  const [count, setCount] = useState(0)

  const subscribe = useCallback((handler) => {
    subscribersRef.current.add(handler)
    setCount((c) => c + 1)
    return () => {
      subscribersRef.current.delete(handler)
      setCount((c) => c - 1)
    }
  }, [])

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  )
  const enabled = Boolean(user && token && count > 0)

  useRealtimePoll({
    url: getStaffStreamUrl().replace('/realtime/events', '/realtime/events/poll'),
    enabled,
    headers,
    onEvent: (data) => {
      subscribersRef.current.forEach((h) => {
        try { h(data) } catch { /* subscriber errors are isolated */ }
      })
    },
  })

  return (
    <RealtimeContext.Provider value={{ subscribe }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtimeSubscribe() {
  return useContext(RealtimeContext)
}
