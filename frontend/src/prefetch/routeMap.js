import { localDateStr } from '../utils/format'

// Chunk prefetch: hanya untuk lazy routes (menu/login sudah static, tidak perlu)
export const chunkPrefetch = {
  '/admin': () => import('../staff/views/admin/AdminDashboard'),
  '/admin/products': () => import('../staff/views/admin/ProductsPage'),
  '/admin/categories': () => import('../staff/views/admin/CategoriesPage'),
  '/admin/tables': () => import('../staff/views/admin/TablesPage'),
  '/admin/orders': () => import('../staff/views/admin/OrdersPage'),
  '/admin/reports/sales': () => import('../staff/views/SalesReportPage'),
  '/admin/settings': () => import('../staff/views/admin/SettingsPage'),
  '/admin/staff': () => import('../staff/views/admin/UsersPage'),
  '/admin/audit-logs': () => import('../staff/views/admin/AuditLogsPage'),
  '/admin/stock-history': () => import('../staff/views/admin/StockHistoryPage'),
  '/cashier': () => import('../staff/views/cashier/CashierDashboard'),
  '/cashier/reports/sales': () => import('../staff/views/SalesReportPage'),
}

// API prefetch menggunakan cache yang sama dengan client.js (GET 15s)
import { getDashboardStats, getSalesReport, getProducts, getCategories, getRestaurantTables, getOrders, getSettings, getUsers, getAuditLogs, getStockMutations } from '../api/client'

export const apiPrefetch = {
  '/admin': () => Promise.allSettled([
    getDashboardStats().catch(()=>null),
    getSalesReport('day', localDateStr()).catch(()=>null),
    getSalesReport('week', localDateStr()).catch(()=>null),
  ]),
  '/admin/products': () => Promise.allSettled([
    getProducts({ per_page: 15 }).catch(()=>null),
    getCategories({ per_page: 50 }).catch(()=>null),
  ]),
  '/admin/categories': () => getCategories({ per_page: 50 }).catch(()=>null),
  '/admin/tables': () => getRestaurantTables({ per_page: 50 }).catch(()=>null),
  '/admin/orders': () => getOrders({ per_page: 15 }).catch(()=>null),
  '/admin/reports/sales': () => getSalesReport('day', localDateStr()).catch(()=>null),
  '/admin/settings': () => getSettings().catch(()=>null),
  '/admin/staff': () => getUsers({ per_page: 50 }).catch(()=>null),
  '/admin/audit-logs': () => getAuditLogs({ per_page: 15 }).catch(()=>null),
  '/admin/stock-history': () => getStockMutations({ per_page: 15 }).catch(()=>null),
  '/cashier': () => Promise.allSettled([
    getDashboardStats().catch(()=>null),
    getOrders({ per_page: 15 }).catch(()=>null),
  ]),
  '/menu': () => Promise.allSettled([
    getProducts({ per_page: 50 }).catch(()=>null),
    getCategories({ per_page: 50 }).catch(()=>null),
  ]),
}

// Strategy: from current route, which routes are likely next
export const prefetchStrategy = {
  '/admin': ['/admin/orders', '/admin/products', '/admin/tables'],
  '/admin/orders': ['/admin/products', '/admin/reports/sales'],
  '/admin/products': ['/admin/categories'],
  '/admin/categories': ['/admin/products'],
  '/admin/tables': ['/admin/orders'],
  '/cashier': ['/cashier/reports/sales'],
  '/': ['/menu'],
  '/menu': [],
}
