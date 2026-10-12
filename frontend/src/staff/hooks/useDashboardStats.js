import { useEffect, useRef, useState } from 'react'
import { clearCacheFor, getDashboardStats } from '../../api/client'
import { useStaffRealtime } from './useStaffRealtime'

const EMPTY = {
  pending_orders: 0,
  confirmed_orders: 0,
  preparing_orders: 0,
  ready_orders: 0,
  unpaid_orders: 0,
  pending_proofs: 0,
  low_stock_count: 0,
  maintenance_tables: 0,
  occupied_tables: 0,
  today_revenue: 0,
  today_transactions: 0,
  today_paid: 0,
  today_unpaid: 0,
  today_quantity: 0,
  today_profit: 0,
  today_average: 0,
  today_label: '',
}

export function useDashboardStats() {
  const [stats, setStats] = useState(EMPTY)
  const setStatsRef = useRef(setStats)

  useEffect(() => {
    setStatsRef.current = setStats
  }, [setStats])

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats()
        if (!cancelled) setStats(data)
      } catch {
        if (cancelled) return
      }
    }
    fetchStats()
    return () => {
      cancelled = true
    }
  }, [])

  useStaffRealtime({
    onEvent: (event) => {
      if (event?.channel === 'dashboard') {
        clearCacheFor('/dashboard/stats')
        clearCacheFor('/reports/sales')
        getDashboardStats()
          .then((data) => setStatsRef.current(data))
          .catch(() => {})
      }
    },
  })

  return stats
}