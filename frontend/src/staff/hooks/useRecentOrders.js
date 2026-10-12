import { useEffect, useState } from 'react'
import { getOrders } from '../../api/client'

export function useRecentOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await getOrders({ per_page: 8 })
        if (!cancelled) {
          setOrders(data.items || [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { orders, loading, error }
}
