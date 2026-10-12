import { useEffect, useRef } from 'react'

const globalAfter = new Map()

export function useSse({ url, enabled = true, headers, onEvent, onEnd, onError }) {
  const afterRef = useRef(globalAfter.get(url) || 0)
  const handlerRef = useRef({ onEvent, onEnd, onError })

  useEffect(() => {
    handlerRef.current = { onEvent, onEnd, onError }
  }, [onEvent, onEnd, onError])

  useEffect(() => {
    afterRef.current = globalAfter.get(url) || 0
  }, [url])

  useEffect(() => {
    if (!enabled || !url) return

    let running = true
    let controller = null
    let retryTimer = null

    const connect = async () => {
      if (!running) return

      const sep = url.includes('?') ? '&' : '?'
      controller = new AbortController()

      try {
        const response = await fetch(`${url}${sep}after=${afterRef.current}`, {
          headers: {
            Accept: 'text/event-stream',
            ...headers,
          },
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          const err = new Error(`SSE status ${response.status}`)
          err.status = response.status
          throw err
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (running) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let boundary
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)

            let id = null
            let data = ''
            for (const line of block.split('\n')) {
              if (line.startsWith('id:')) id = line.slice(3).trim()
              else if (line.startsWith('data:')) data += line.slice(5).trim()
            }

            if (id !== null) {
              const numeric = Number(id) || 0
              if (numeric > afterRef.current) {
                afterRef.current = numeric
                globalAfter.set(url, numeric)
              }
            }

            if (data) {
              let parsed = null
              try {
                parsed = JSON.parse(data)
              } catch {
                parsed = { raw: data }
              }
              handlerRef.current.onEvent?.(parsed)
            }
          }
        }

        handlerRef.current.onEnd?.()
      } catch (err) {
        if (err.name === 'AbortError') return
        if (err.status === 401) {
          handlerRef.current.onError?.(err)
          return
        }
        handlerRef.current.onError?.(err)
      } finally {
        controller = null
      }

      if (running) {
        retryTimer = setTimeout(connect, 1500)
      }
    }

    connect()

    return () => {
      running = false
      clearTimeout(retryTimer)
      if (controller) controller.abort()
    }
  }, [url, enabled, headers])
}
