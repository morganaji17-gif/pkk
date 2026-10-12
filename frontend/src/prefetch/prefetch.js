import { chunkPrefetch, apiPrefetch, prefetchStrategy } from './routeMap'

const prefetchedChunks = new Set()
let idleCallbackId = null

export function prefetchChunk(route) {
  const loader = chunkPrefetch[route]
  if (!loader || prefetchedChunks.has(route)) return
  prefetchedChunks.add(route)
  loader().catch(() => { /* ignore */ })
}

export function prefetchApi(route) {
  const loader = apiPrefetch[route]
  if (!loader) return
  // eslint-disable-next-line no-empty
  try { const res = loader(); if (res && typeof res.catch === 'function') res.catch(() => { /* ignore */ }); } catch {}
}

export function prefetchRoute(route) {
  prefetchChunk(route)
  prefetchApi(route)
}

// Prefetch on hover/focus intent
export function createPrefetchHandlers(route) {
  let timeout = null
  const trigger = () => prefetchRoute(route)
  return {
    onMouseEnter: () => { timeout = setTimeout(trigger, 80) },
    onMouseLeave: () => { if (timeout) clearTimeout(timeout) },
    onFocus: trigger,
  }
}

// Idle prefetch for likely next routes (after current page usable)
export function prefetchIdle(currentRoute) {
  if (idleCallbackId) return
  const nextRoutes = prefetchStrategy[currentRoute] || []
  if (nextRoutes.length === 0) return
  const schedule = window.requestIdleCallback || ((cb)=> setTimeout(cb, 800))
  idleCallbackId = schedule(() => {
    idleCallbackId = null
    nextRoutes.forEach((r) => prefetchRoute(r))
  })
}


