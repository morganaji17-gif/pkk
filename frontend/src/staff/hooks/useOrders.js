/* eslint-disable react-hooks/set-state-in-effect -- SWR: render cached immediately */
import { useCallback, useEffect, useState } from 'react'
import { getOrders, peekOrdersCache } from '../../api/client'

const PAGE_SIZE = 15

export function useOrders(filters = {}) {
  const [orders, setOrders] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const search = filters.search || ''
  const status = filters.status || ''
  const paymentStatus = filters.payment_status || ''

  const buildParams = useCallback(
    (page) => ({
      search: search || undefined,
      status: status || undefined,
      payment_status: paymentStatus || undefined,
      page,
      per_page: PAGE_SIZE,
    }),
    [search, status, paymentStatus]
  )

  useEffect(() => {
    let cancelled = false
    const cached = peekOrdersCache(buildParams(1))
    const hasCached = !!cached
    if (hasCached) {
      setOrders(cached.items || [])
      setMeta(cached.meta || null)
      setError(null)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const load = async () => {
      if (!hasCached) setError(null)
      try {
        // Selalu revalidasi di background agar tidak tampil data basi,
        // cache hanya dipakai untuk first paint cepat.
        const data = await getOrders(buildParams(1), { revalidate: true })
        if (cancelled) return
        setOrders(data.items)
        setMeta(data.meta)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (!hasCached) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    // Only fetch in background if we already have cached, otherwise load will be the initial fetch
    load()
    return () => {
      cancelled = true
    }
  }, [buildParams, reloadKey])

  const loadMore = useCallback(async () => {
    if (loadingMore || !meta?.has_more) return
    setLoadingMore(true)
    setError(null)
    try {
      const nextPage = (meta?.current_page ?? 0) + 1
      const data = await getOrders(buildParams(nextPage))
      setOrders((prev) => [...prev, ...data.items])
      setMeta(data.meta)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }, [buildParams, loadingMore, meta])

  const refresh = useCallback(() => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }, [])

  /**
   * Refresh senyap: ambil data segar tanpa skeleton.
   * Dipakai untuk event realtime + setelah aksi, agar UI tidak berkedip.
   */
  const refreshQuiet = useCallback(async () => {
    setError(null)
    try {
      const data = await getOrders(buildParams(1), { revalidate: true })
      setOrders(data.items)
      setMeta(data.meta)
    } catch (err) {
      setError(err.message)
    }
  }, [buildParams])

  /**
   * Patch optimistis satu order di state lokal (mis. pindah kolom KDS
   * segera setelah aksi sukses, tanpa menunggu refetch).
   */
  const updateLocal = useCallback((orderId, patch) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, ...patch } : order
      )
    )
  }, [])

  return { orders, meta, loading, loadingMore, error, refresh, refreshQuiet, updateLocal, loadMore }
}