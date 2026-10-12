import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'
import ProtectedRoute from './staff/components/ProtectedRoute'
import StaffLayout from './staff/components/StaffLayout'
import LoginView from './staff/views/LoginView'
import NotFound from './staff/views/NotFound'
import LoadingState from './components/LoadingState'

const AdminDashboard = lazy(() => import('./staff/views/admin/AdminDashboard'))
const ProductsPage = lazy(() => import('./staff/views/admin/ProductsPage'))
const CategoriesPage = lazy(() => import('./staff/views/admin/CategoriesPage'))
const TablesPage = lazy(() => import('./staff/views/admin/TablesPage'))
const OrdersPage = lazy(() => import('./staff/views/admin/OrdersPage'))
const CashierDashboard = lazy(() => import('./staff/views/cashier/CashierDashboard'))
const CashierOrderDetailPage = lazy(() => import('./staff/views/cashier/CashierOrderDetailPage'))
const KitchenDashboard = lazy(() => import('./staff/views/kitchen/KitchenDashboard'))
const SalesReportPage = lazy(() => import('./staff/views/SalesReportPage'))
const SettingsPage = lazy(() => import('./staff/views/admin/SettingsPage'))
const UsersPage = lazy(() => import('./staff/views/admin/UsersPage'))
const AuditLogsPage = lazy(() => import('./staff/views/admin/AuditLogsPage'))
const StockHistoryPage = lazy(() => import('./staff/views/admin/StockHistoryPage'))

function destinationForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'kitchen') return '/kitchen'
  return '/cashier'
}

function HomeRedirect() {
  const { user, initializing } = useAuth()
  if (initializing) return null
  if (user) {
    return <Navigate to={destinationForRole(user.role)} replace />
  }
  return <Navigate to="/menu" replace />
}

export default function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState label="Memuat halaman…" />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />

      <Route path="/menu" element={<App />} />

      <Route path="/login" element={<LoginView />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<CashierOrderDetailPage />} />
        <Route path="reports/sales" element={<SalesReportPage />} />
<Route path="settings" element={<SettingsPage />} />
<Route path="staff" element={<UsersPage />} />
<Route path="audit-logs" element={<AuditLogsPage />} />
<Route path="stock-history" element={<StockHistoryPage />} />
</Route>

      <Route
        path="/cashier"
        element={
          <ProtectedRoute roles={['cashier', 'admin']}>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CashierDashboard />} />
        <Route path="orders/:id" element={<CashierOrderDetailPage />} />
        <Route path="reports/sales" element={<SalesReportPage />} />
      </Route>

      <Route
        path="/kitchen"
        element={
          <ProtectedRoute roles={['kitchen', 'admin']}>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<KitchenDashboard />} />
        <Route path="orders/:id" element={<CashierOrderDetailPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
