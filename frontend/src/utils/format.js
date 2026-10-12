const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')
const STORAGE_BASE_URL = `${API_ORIGIN}/storage`

export function formatRupiah(value) {
  const number = Number(value)
  if (Number.isNaN(number)) return '-'
  return `Rp ${number.toLocaleString('id-ID')}`
}

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function localDateStr(date = new Date()) {
  return date.toLocaleDateString('sv-SE')
}

export function resolveImageUrl(image) {
  if (!image) return null
  if (/^https?:\/\//.test(image)) return image
  if (image.startsWith('/')) return `${API_ORIGIN}${image}`
  return `${STORAGE_BASE_URL}/${image}`
}

export const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  qris: 'QRIS',
}

export function getOrderItems(order) {
  const items = Array.isArray(order.orderItems)
    ? order.orderItems
    : Array.isArray(order.order_items)
      ? order.order_items
      : []
  return items
}

export function fieldError(fieldErrors, field) {
  if (!fieldErrors) return null
  const messages = fieldErrors[field]
  if (!messages || !Array.isArray(messages)) return null
  return messages[0]
}
