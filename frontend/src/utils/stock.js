export const STOCK_STATUS_META = {
  out: { label: 'Habis', className: 'stock-badge--out' },
  low: { label: 'Stok Menipis', className: 'stock-badge--low' },
  normal: { label: 'Stok Cukup', className: 'stock-badge--normal' },
}

export function stockStatusLabel(status) {
  return STOCK_STATUS_META[status]?.label || 'Stok Cukup'
}

export function stockStatusClass(status) {
  return STOCK_STATUS_META[status]?.className || 'stock-badge--normal'
}