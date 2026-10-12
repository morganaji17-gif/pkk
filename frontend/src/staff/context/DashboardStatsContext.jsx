/* eslint-disable react-refresh/only-export-components -- context + hooks shared */
import { createContext, useContext } from 'react'

const DashboardStatsContext = createContext({
  pending_orders: 0,
  low_stock_count: 0,
  maintenance_tables: 0,
  occupied_tables: 0,
})

export function DashboardStatsProvider({ stats, children }) {
  return (
    <DashboardStatsContext.Provider value={stats}>
      {children}
    </DashboardStatsContext.Provider>
  )
}

export function useDashboardStats() {
  return useContext(DashboardStatsContext)
}
