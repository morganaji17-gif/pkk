import { useEffect, useState } from 'react'
import { getSalesReport } from '../../api/client'
import { localDateStr } from '../../utils/format'

function usePeriodReport(period, intervalMs) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (document.hidden) return
      try {
        const data = await getSalesReport(period, localDateStr())
        if (!cancelled) {
          setReport(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, intervalMs)
    const onVisibility = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [period, intervalMs])

  return { report, loading, error }
}

export function useDayReport() {
  return usePeriodReport('day', 60000)
}

export function useWeeklyReport() {
  return usePeriodReport('week', 300000)
}
