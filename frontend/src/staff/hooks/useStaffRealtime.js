import { useEffect } from 'react'
import { useRealtimeSubscribe } from '../context/RealtimeContext'

export function useStaffRealtime({ onEvent, enabled = true }) {
  const { subscribe } = useRealtimeSubscribe()
  useEffect(() => {
    if (!enabled || !onEvent) return undefined
    return subscribe(onEvent)
  }, [onEvent, enabled, subscribe])
}