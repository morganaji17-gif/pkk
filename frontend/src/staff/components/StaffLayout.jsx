import { useState } from 'react'
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../auth/useAuth'
import { useDashboardStats as useDashboardStatsHook } from '../hooks/useDashboardStats'
import { DashboardStatsProvider } from '../context/DashboardStatsContext'
import { RealtimeProvider } from '../context/RealtimeContext'
import { createPrefetchHandlers } from '../../prefetch/prefetch'

function Icon({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const ICONS = {
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Icon>
  ),
  products: (
    <Icon>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </Icon>
  ),
  categories: (
    <Icon>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </Icon>
  ),
  tables: (
    <Icon>
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M5 12v7h14v-7" />
      <path d="M10 19v-3a2 2 0 0 1 4 0v3" />
    </Icon>
  ),
  orders: (
    <Icon>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </Icon>
  ),
  reports: (
    <Icon>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  ),
  staff: (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  audit: (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </Icon>
  ),
  stock: (
    <Icon>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </Icon>
  ),
  logout: (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  ),
}

const NAV_ITEMS = {
  admin: [
    { to: '/admin', label: 'Dashboard', end: true, icon: ICONS.dashboard },
    { to: '/admin/products', label: 'Produk', icon: ICONS.products, badge: 'low_stock_count' },
    { to: '/admin/categories', label: 'Kategori', icon: ICONS.categories },
    { to: '/admin/tables', label: 'Meja', icon: ICONS.tables, badge: 'maintenance_tables' },
    { to: '/admin/orders', label: 'Pesanan', icon: ICONS.orders, badge: 'pending_orders' },
    { to: '/admin/reports/sales', label: 'Laporan', icon: ICONS.reports },
    { to: '/admin/settings', label: 'Pengaturan', icon: ICONS.settings },
    { to: '/admin/staff', label: 'Staf', icon: ICONS.staff },
    { to: '/admin/audit-logs', label: 'Log Audit', icon: ICONS.audit },
    { to: '/admin/stock-history', label: 'Riwayat Stok', icon: ICONS.stock },
  ],
  cashier: [
    { to: '/cashier', label: 'Pesanan', end: true, icon: ICONS.orders, badge: 'pending_orders' },
    { to: '/cashier/reports/sales', label: 'Laporan', icon: ICONS.reports },
  ],
  kitchen: [
    { to: '/kitchen', label: 'Dapur', end: true, icon: ICONS.orders, badge: 'confirmed_orders' },
  ],
}

function roleLabel(role) {
  if (role === 'admin') return 'Administrator'
  if (role === 'kitchen') return 'Dapur'
  return 'Kasir'
}

function Brand() {
  return (
    <Link to="/" className="staff-brand">
      <span className="staff-brand__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
          <path d="M4 2h16" />
          <path d="M6 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2" />
          <path d="M9 16v4" />
          <path d="M15 16v4" />
          <path d="M8 22h8" />
        </svg>
      </span>
      Pesanin
    </Link>
  )
}

function StaffLayoutInner() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const stats = useDashboardStatsHook()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const items = user?.role ? NAV_ITEMS[user.role] || [] : []
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`staff-shell${drawerOpen ? ' staff-shell--drawer-open' : ''}`}>
      {drawerOpen && (
        <div
          className="staff-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className="staff-sidebar">
        <Brand />
        <nav className="staff-nav" aria-label="Navigasi staff">
          {items.map((item) => {
            const count = item.badge ? stats[item.badge] : 0
            const prefetchHandlers = createPrefetchHandlers(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setDrawerOpen(false)}
                onMouseEnter={prefetchHandlers.onMouseEnter}
                onMouseLeave={prefetchHandlers.onMouseLeave}
                onFocus={prefetchHandlers.onFocus}
                className={({ isActive }) =>
                  `staff-nav__link ${isActive ? 'staff-nav__link--active' : ''}`
                }
              >
                <span className="staff-nav__icon">{item.icon}</span>
                <span>{item.label}</span>
                {count > 0 && (
                  <span className="staff-nav__badge" title={`${count} item perlu perhatian`}>
                    {count}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="staff-user">
          <span className="staff-user__avatar" aria-hidden="true">
            {initial}
          </span>
          <span className="staff-user__meta">
            <span className="staff-user__name">{user?.name}</span>
            <span className="staff-user__role">
              {roleLabel(user?.role)}
            </span>
          </span>
          <button
            type="button"
            className="staff-user__logout"
            onClick={handleLogout}
            title="Keluar"
            aria-label="Keluar"
          >
            {ICONS.logout}
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="staff-hamburger"
        onClick={() => setDrawerOpen(true)}
        aria-label="Buka menu navigasi"
      >
        <Icon>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </Icon>
      </button>

      <DashboardStatsProvider stats={stats}>
        <div className="staff-main">
          <main className="staff-content">
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={location.pathname}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </DashboardStatsProvider>
    </div>
  )
}

export default function StaffLayout() {
  return (
    <RealtimeProvider>
      <StaffLayoutInner />
    </RealtimeProvider>
  )
}
