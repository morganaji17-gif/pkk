import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Buat key unik per item keranjang (product + pilihan varian).
 */
export function buildCartKey(productId, selectedOptions) {
  const ids = (selectedOptions || [])
    .map((o) => Number(o?.option_id || 0))
    .filter(Boolean)
    .sort((a, b) => a - b)
  if (ids.length === 0) return String(productId)
  return `${productId}|${ids.join(',')}`
}

/**
 * Hitung harga satuan item berdasarkan harga dasar produk + tambahan opsi.
 */
export function computeItemUnitPrice(product, selectedOptions) {
  const base = Number(product?.price || 0)
  let extra = 0
  if (Array.isArray(selectedOptions)) {
    for (const o of selectedOptions) {
      extra += Number(o?.additional_price || 0)
    }
  }
  return base + extra
}

export function useCart() {
  const [items, setItems] = useState([])

  // Key per item = productId + sorted option_ids
  const getKey = useCallback((product, selectedOptions) => {
    return buildCartKey(product.id, selectedOptions)
  }, [])

  const addToCart = useCallback((product, quantity = 1, selectedOptions = []) => {
    if (!product || product.stock <= 0 || quantity <= 0) return
    const key = getKey(product, selectedOptions)
    setItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.key === key)
      const maxQty = product.stock
      if (existingIdx >= 0) {
        const updated = [...prev]
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: Math.min(updated[existingIdx].quantity + quantity, maxQty),
        }
        return updated
      }
      return [
        ...prev,
        {
          key,
          product,
          quantity: Math.min(quantity, maxQty),
          selectedOptions: selectedOptions || [],
        },
      ]
    })
  }, [getKey])

  const updateQuantity = useCallback((key, quantity) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.key === key
            ? {
                ...item,
                quantity: Math.max(0, Math.min(quantity, item.product.stock)),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }, [])

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }, [])

  const setItemNotes = useCallback((key, notes) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, notes: notes || undefined } : item
      )
    )
  }, [])

  // Ops varian per key
  const setSelectedOptions = useCallback((key, selectedOptions) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, selectedOptions: selectedOptions || [] }
          : item
      )
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const unitPrice = computeItemUnitPrice(item.product, item.selectedOptions)
      return sum + unitPrice * item.quantity
    }, 0)
  }, [items])

  const count = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])

  return {
    items,
    total,
    count,
    addToCart,
    updateQuantity,
    removeItem,
    setItemNotes,
    setSelectedOptions,
    clearCart,
    buildCartKey,
  }
}
