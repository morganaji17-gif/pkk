import { useEffect, useRef } from 'react'

export function useRealtimePoll({ url, enabled = true, headers, interval = 3000, onEvent, onError }) {
  const afterRef = useRef(0)
  const handlerRef = useRef({ onEvent, onError })

  useEffect(() => {
    handlerRef.current = { onEvent, onError }
  }, [onEvent, onError])

  useEffect(() => {
    if (!enabled || !url) return undefined

    let stopped = false
    let timer = null

    const poll = async () => {
      try {
        const separator = url.includes('?') ? '&' : '?'
        const response = await fetch(`${url}${separator}after=${afterRef.current}`, {
          headers: { Accept: 'application/json', ...headers },
        })
        if (!response.ok) {
          const error = new Error(`Realtime poll status ${response.status}`)
          error.status = response.status
          throw error
        }
        const result = await response.json()
        for (const event of result.events || []) {
          if (Number(event.id) > afterRef.current) afterRef.current = Number(event.id)
          handlerRef.current.onEvent?.({ channel: event.channel, payload: event.payload })
        }
      } catch (error) {
        if (!stopped) handlerRef.current.onError?.(error)
      } finally {
        if (!stopped) timer = setTimeout(poll, interval)
      }
    }

    poll()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [url, enabled, headers, interval])
}
