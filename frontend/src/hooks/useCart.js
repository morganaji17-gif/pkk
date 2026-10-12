import { useCallback, useState } from 'react'

export function useCart() {
  const [items, setItems] = useState([])

  const addToCart = useCallback((product, quantity = 1) => {
    if (!product || product.stock <= 0 || quantity <= 0) return
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + quantity,
                  product.stock
                ),
              }
            : item
        )
      }
      return [
        ...prev,
        {
          product,
          quantity: Math.min(quantity, product.stock),
        },
      ]
    })
  }, [])

  const updateQuantity = useCallback((productId, quantity) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: Math.max(0, Math.min(quantity, item.product.stock)),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }, [])

  const removeItem = useCallback((productId) => {
    setItems((prev) =>
      prev.filter((item) => item.product.id !== productId)
    )
  }, [])

  const setItemNotes = useCallback((productId, notes) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, notes: notes || undefined }
          : item
      )
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const total = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  )
  const count = items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    items,
    total,
    count,
    addToCart,
    updateQuantity,
    removeItem,
    setItemNotes,
    clearCart,
  }
}
