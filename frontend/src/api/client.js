import { getStoredToken } from '../auth/storage'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export class ApiError extends Error {
  constructor(message, { status = null, fieldErrors = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function resolveHeaders(options) {
  const headers = {
    Accept: 'application/json',
    ...options.headers,
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.auth) {
    const token = getStoredToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return headers
}

const _cache = new Map()
const _inflight = new Map()
function isCacheable(path) {
  // Cache semua GET yang aman untuk stale-while-revalidate (tidak untuk checkout/payment/mutasi)
  if (path.includes('/checkout') || path.includes('/login') || path.includes('/logout')) return false
  if (path.includes('/reports/sales/export')) return false
  // Hanya GET
  return true
}
function cacheTtlFor(path) {
  if (path.includes('/categories') || path.includes('/products') || path.includes('/users') || path.includes('/settings')) return 60000
  if (path.includes('/dashboard/stats') || path.includes('/reports/sales?')) return 15000
  return 10000
}
function getCached(path) {
  const entry = _cache.get(path)
  if (!entry) return null
  if (Date.now() - entry.ts > cacheTtlFor(path)) {
    _cache.delete(path)
    return null
  }
  return entry.data
}
function setCached(path, data) {
  _cache.set(path, { data, ts: Date.now() })
}
export function clearCacheFor(pathFragment) {
  for (const k of _cache.keys()) if (k.includes(pathFragment)) _cache.delete(k)
}
export function clearAllCache() {
  _cache.clear()
  _inflight.clear()
}

/**
 * Invalidasi terpusat setelah mutasi.
 * Dipanggil di dalam fungsi mutasi client agar semua pemanggil
 * (KDS, kasir, admin, customer) selalu melihat data segar.
 */
export function invalidateOrderCaches() {
  clearCacheFor('/orders')
  clearCacheFor('/dashboard/stats')
  clearCacheFor('/reports/sales')
}

export function invalidateDashboardCaches() {
  clearCacheFor('/dashboard/stats')
}

function toFormData(data) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (value instanceof File) {
      formData.append(key, value)
    } else if (typeof value === 'boolean') {
      formData.append(key, value ? '1' : '0')
    } else {
      formData.append(key, String(value))
    }
  }
  return formData
}

async function request(path, options = {}) {
  const isGet = !options.method || options.method.toUpperCase() === 'GET'
  // revalidate: lewati bacaan cache (tetap tulis hasil segar ke cache).
  const cacheable = isGet && isCacheable(path) && !options.revalidate
  if (cacheable) {
    const cached = getCached(path)
    if (cached !== null) return cached
    if (_inflight.has(path)) return _inflight.get(path)
  }

  const exec = async () => {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: resolveHeaders(options),
      signal: options.signal,
    })
  } catch {
    throw new ApiError(
      'Tidak dapat terhubung ke server. Periksa koneksi internet atau pastikan server aktif.',
      { status: null }
    )
  }

  let payload = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      (response.status === 401
        ? 'Sesi Anda telah berakhir. Silakan masuk kembali.'
        : response.status === 403
          ? 'Anda tidak memiliki akses ke fitur ini.'
          : response.status === 404
            ? 'Data yang diminta tidak ditemukan.'
            : response.status === 422
              ? 'Data yang dikirim tidak valid. Silakan periksa kembali.'
              : 'Terjadi kesalahan pada server. Silakan coba lagi.')
    throw new ApiError(message, {
      status: response.status,
      fieldErrors: payload?.errors || null,
    })
  }

    const result = options.full ? payload : (payload?.data !== undefined ? payload.data : payload)
    if (cacheable) setCached(path, result)
    return result
  }
  if (cacheable) {
    const promise = exec()
    _inflight.set(path, promise)
    try {
      return await promise
    } finally {
      _inflight.delete(path)
    }
  }
  return exec()
}

export function getRestaurantTable(id) {
  return request(`/restaurant-tables/${id}`)
}

export function getRestaurantTableQrUrl(id) {
  return `${BASE_URL}/restaurant-tables/${id}/qr`
}

export function getOrderStreamUrl(trackingToken) {
  return `${BASE_URL}/orders/track/${encodeURIComponent(trackingToken)}/events`
}

export function getStaffStreamUrl() {
  return `${BASE_URL}/realtime/events`
}

export function getStaffEventsPollUrl() {
  return `${BASE_URL}/realtime/events/poll`
}

export function getOrderEventsPollUrl(trackingToken) {
  return `${BASE_URL}/orders/track/${encodeURIComponent(trackingToken)}/events/poll`
}

export function buildQuery(params) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export function peekCached(path) {
  return getCached(path)
}

export function hasCached(path) {
  return getCached(path) !== null
}

export function peekProductsCache(params = {}) {
  const payload = getCached(`/products${buildQuery(params)}`)
  if (!payload) return null
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return null
}
export function peekCategoriesCache(params = {}) {
  const payload = getCached(`/categories${buildQuery(params)}`)
  if (!payload) return null
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return null
}
export function peekOrdersCache(params = {}) {
  const qs = new URLSearchParams()
  for (const [k,v] of Object.entries(params)) if (v!==undefined && v!==null && v!=='') qs.set(k,v)
  const q = qs.toString()
  const payload = getCached(`/orders${q?`?${q}`:''}`)
  if (!payload) return null
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return null
}
export function peekTablesCache(params = {}) {
  const payload = getCached(`/restaurant-tables${buildQuery(params)}`)
  if (!payload) return null
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return null
}
export function peekDashboardCache() {
  return getCached('/dashboard/stats')
}
export function peekSalesCache(period, date) {
  return getCached(`/reports/sales?${new URLSearchParams({period, date}).toString()}`)
}
export function peekUsersCache(params = {}) {
  const payload = getCached(`/users${buildQuery(params)}`)
  if (!payload) return null
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return null
}
export function peekAuditLogsCache(params = {}) {
  const payload = getCached(`/audit-logs${buildQuery(params)}`)
  if (!payload) return null
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta ?? null,
  }
}
export function peekStockMutationsCache(params = {}) {
  const payload = getCached(`/stock-mutations${buildQuery(params)}`)
  if (!payload) return null
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta ?? null,
  }
}

export async function getProducts(params = {}) {
  const payload = await request(`/products${buildQuery(params)}`, { full: true })
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return { items: [], meta: null }
}

export function getProduct(id) {
  return request(`/products/${id}`)
}

export async function getCategories(params = {}) {
  const payload = await request(`/categories${buildQuery(params)}`, { full: true })
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return { items: [], meta: null }
}

export function checkout(body) {
  return request('/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  }).then((data) => {
    invalidateOrderCaches()
    return data
  })
}

export function trackOrder(trackingToken, opts = {}) {
  return request(`/orders/track/${encodeURIComponent(trackingToken)}`, {
    ...(opts.revalidate ? { revalidate: true } : null),
  })
}

export function loginRequest(credentials) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function logoutRequest() {
  return request('/logout', {
    method: 'POST',
    auth: true,
  })
}

export async function getRestaurantTables(params = {}) {
  const payload = await request(`/restaurant-tables${buildQuery(params)}`, { auth: true, full: true })
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return { items: [], meta: null }
}

export async function getOrders(params = {}, opts = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, value)
  }
  const qs = query.toString()
  const payload = await request(`/orders${qs ? `?${qs}` : ''}`, {
    auth: true,
    full: true,
    ...(opts.revalidate ? { revalidate: true } : null),
  })
  return {
    items: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta ?? null,
  }
}

export function getOrder(id, opts = {}) {
  return request(`/orders/${id}`, {
    auth: true,
    ...(opts.revalidate ? { revalidate: true } : null),
  })
}

export function updateOrderStatus(id, status) {
  return request(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    auth: true,
  }).then((data) => {
    invalidateOrderCaches()
    return data
  })
}

export function updateOrderPayment(id, options = {}) {
  const body = {}
  if (options.action) body.action = options.action
  if (options.reject_note) body.reject_note = options.reject_note
  return request(`/orders/${id}/payment`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    auth: true,
  }).then((data) => {
    invalidateOrderCaches()
    return data
  })
}

export function confirmOrderPayment(id) {
  return updateOrderPayment(id, { action: 'confirm' })
}

export function rejectOrderPayment(id, reject_note = '') {
  return updateOrderPayment(id, { action: 'reject', reject_note })
}

export function uploadOrderProof(trackingToken, file) {
  const formData = new FormData()
  formData.append('proof', file)
  return request(`/orders/track/${encodeURIComponent(trackingToken)}/proof`, {
    method: 'POST',
    body: formData,
  }).then((data) => {
    invalidateOrderCaches()
    return data
  })
}

export function getSalesReport(period, date) {
  const query = new URLSearchParams({ period, date }).toString()
  return request(`/reports/sales?${query}`, { auth: true })
}

export async function getSalesReportPdf(period, date) {
  const token = getStoredToken()
  const query = new URLSearchParams({ period, date }).toString()
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/sales/export?${query}`, {
      headers: {
        Accept: 'application/pdf',
        Authorization: token ? `Bearer ${token}` : '',
      },
    })
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server.', { status: null })
  }

  if (!response.ok) {
    let message = 'Gagal mengunduh laporan. Silakan coba lagi.'
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        const payload = await response.json()
        if (payload?.message) message = payload.message
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(message, { status: response.status })
  }

  return response.blob()
}

export function createProduct(data) {
  return request('/products', {
    method: 'POST',
    body: toFormData(data),
    auth: true,
  }).then((res) => {
    clearCacheFor('/products')
    invalidateDashboardCaches()
    return res
  })
}

export function updateProduct(id, data) {
  return request(`/products/${id}`, {
    method: 'POST',
    body: toFormData({ _method: 'PUT', ...data }),
    auth: true,
  }).then((res) => {
    clearCacheFor('/products')
    invalidateDashboardCaches()
    return res
  })
}

export function deleteProduct(id) {
  return request(`/products/${id}`, { method: 'DELETE', auth: true }).then((res) => {
    clearCacheFor('/products')
    invalidateDashboardCaches()
    return res
  })
}

export function createCategory(data) {
  return request('/categories', {
    method: 'POST',
    body: toFormData(data),
    auth: true,
  }).then((res) => {
    clearCacheFor('/categories')
    return res
  })
}

export function updateCategory(id, data) {
  return request(`/categories/${id}`, {
    method: 'POST',
    body: toFormData({ _method: 'PUT', ...data }),
    auth: true,
  }).then((res) => {
    clearCacheFor('/categories')
    return res
  })
}

export function deleteCategory(id) {
  return request(`/categories/${id}`, { method: 'DELETE', auth: true }).then((res) => {
    clearCacheFor('/categories')
    return res
  })
}

export function createRestaurantTable(data) {
  return request('/restaurant-tables', {
    method: 'POST',
    body: toFormData(data),
    auth: true,
  }).then((res) => {
    clearCacheFor('/restaurant-tables')
    clearCacheFor('/tables')
    invalidateDashboardCaches()
    return res
  })
}

export function updateRestaurantTable(id, data) {
  return request(`/restaurant-tables/${id}`, {
    method: 'POST',
    body: toFormData({ _method: 'PUT', ...data }),
    auth: true,
  }).then((res) => {
    clearCacheFor('/restaurant-tables')
    clearCacheFor('/tables')
    invalidateDashboardCaches()
    return res
  })
}

export function deleteRestaurantTable(id) {
  return request(`/restaurant-tables/${id}`, { method: 'DELETE', auth: true }).then((res) => {
    clearCacheFor('/restaurant-tables')
    clearCacheFor('/tables')
    invalidateDashboardCaches()
    return res
  })
}

export function updateRestaurantTableStatus(id, status) {
  return request(`/restaurant-tables/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    auth: true,
  }).then((res) => {
    clearCacheFor('/restaurant-tables')
    clearCacheFor('/tables')
    invalidateDashboardCaches()
    return res
  })
}

export function getDashboardStats(opts = {}) {
  return request('/dashboard/stats', {
    auth: true,
    ...(opts.revalidate ? { revalidate: true } : null),
  })
}

export function getSettings() {
  return request('/settings', { auth: true })
}

export function updateQris(formData) {
  return request('/settings/qris', {
    method: 'POST',
    body: formData,
    auth: true,
  }).then((res) => {
    clearCacheFor('/settings')
    invalidateDashboardCaches()
    return res
  })
}

export function getPublicQris() {
  return request('/settings/qris')
}

export function getPublicSettings() {
  return request('/settings/public')
}

export function updateBilling(data) {
  return request('/settings/billing', {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true,
  }).then((res) => {
    clearCacheFor('/settings')
    invalidateDashboardCaches()
    return res
  })
}

export async function getSalesReportCsv(period, date) {
  const token = getStoredToken()
  const query = new URLSearchParams({ period, date, format: 'csv' }).toString()
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/sales/export?${query}`, {
      headers: {
        Accept: 'text/csv',
        Authorization: token ? `Bearer ${token}` : '',
      },
    })
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server.', { status: null })
  }

  if (!response.ok) {
    let message = 'Gagal mengunduh laporan. Silakan coba lagi.'
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        const payload = await response.json()
        if (payload?.message) message = payload.message
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(message, { status: response.status })
  }

  return response.blob()
}

async function getPaginated(path, params = {}) {
  const payload = await request(`${path}${buildQuery(params)}`, { auth: true, full: true })
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta ?? null,
  }
}

export function getAuditLogs(params = {}) {
  return getPaginated('/audit-logs', params)
}

export function getStockMutations(params = {}) {
  return getPaginated('/stock-mutations', params)
}

export async function getUsers(params = {}) {
  const payload = await request(`/users${buildQuery(params)}`, { auth: true, full: true })
  if (payload?.meta) return { items: payload.data || [], meta: payload.meta }
  if (Array.isArray(payload?.data)) return { items: payload.data, meta: null }
  if (Array.isArray(payload)) return { items: payload, meta: null }
  return { items: [], meta: null }
}

export function createUser(body) {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify(body),
    auth: true,
  })
}

export function updateUser(id, body) {
  return request(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    auth: true,
  })
}

export function deleteUser(id) {
  return request(`/users/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}
