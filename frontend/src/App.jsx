import { useEffect, useState } from 'react'
import { getRestaurantTable, checkout } from './api/client'
import { ApiError } from './api/client'
import { useCart } from './hooks/useCart'
import LoadingState from './components/LoadingState'
import ErrorState from './components/ErrorState'
import CartBar from './components/CartBar'
import CartDrawer from './components/CartDrawer'
import ProductDetailSheet from './components/ProductDetailSheet'
import MenuView from './views/MenuView'
import CheckoutView from './views/CheckoutView'
import OrderTrackingView from './views/OrderTrackingView'
import { toastSuccess } from './utils/swal'

const ORDER_STORAGE_KEY = 'pesanin_tracking_token'

function getTableIdFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('table')
  if (!raw) return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

function readStoredTrackingToken() {
  try {
    return sessionStorage.getItem(ORDER_STORAGE_KEY)
  } catch {
    return null
  }
}

function App() {
  const tableId = getTableIdFromUrl()

  const [table, setTable] = useState(null)
  const [tableError, setTableError] = useState(() =>
    tableId ? null : 'Tautan meja tidak valid.'
  )
  const [tableRetry, setTableRetry] = useState(0)

  const [trackingToken, setTrackingToken] = useState(() => readStoredTrackingToken())
  const [orderMeta, setOrderMeta] = useState(null)
  const [view, setView] = useState(() =>
    readStoredTrackingToken() ? 'tracking' : 'menu'
  )
  const [cartOpen, setCartOpen] = useState(false)
  const [detailProductId, setDetailProductId] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)

  const cart = useCart()

  const tableLoading = tableId !== null && !table && !tableError

  useEffect(() => {
    if (!tableId) return
    let cancelled = false
    const load = async () => {
      try {
        const data = await getRestaurantTable(tableId)
        if (!cancelled) setTable(data)
      } catch (err) {
        if (!cancelled) setTableError(err.message)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tableId, tableRetry])

  const retryTable = () => {
    setTable(null)
    setTableError(null)
    setTableRetry((n) => n + 1)
  }

  const handleAddProduct = (product, quantity = 1) => {
    cart.addToCart(product, quantity)
  }

  const handleSubmitOrder = async (customerName, paymentMethod = 'cash', orderNotes = '') => {
    if (!tableId) {
      setCheckoutError('Tautan meja tidak valid.')
      return
    }
    if (cart.items.length === 0) {
      setCheckoutError('Keranjang Anda masih kosong.')
      return
    }
    if (paymentMethod !== 'cash' && paymentMethod !== 'qris') {
      setCheckoutError('Pilih metode pembayaran terlebih dahulu.')
      return
    }
    const isAppending = Boolean(trackingToken)
    const resolvedName = isAppending && orderMeta ? orderMeta.customer_name : customerName
    const resolvedMethod = isAppending && orderMeta ? orderMeta.payment_method : paymentMethod
    setSubmitting(true)
    setCheckoutError(null)
    try {
      const payload = {
        restaurant_table_id: tableId,
        customer_name: resolvedName,
        payment_method: resolvedMethod,
        tracking_token: isAppending ? trackingToken : undefined,
        notes: orderNotes || undefined,
        items: cart.items.map(({ product, quantity, notes }) => ({
          product_id: product.id,
          quantity,
          notes: notes || undefined,
        })),
      }
      const data = await checkout(payload)
      cart.clearCart()
      const newToken = data.tracking_token
      try {
        if (newToken) sessionStorage.setItem(ORDER_STORAGE_KEY, newToken)
      } catch {
        // sessionStorage mungkin tidak tersedia; lanjut tanpa persist.
      }
      if (newToken) setTrackingToken(newToken)
      if (!isAppending) {
        setOrderMeta({ customer_name: resolvedName, payment_method: resolvedMethod, order_number: data.order_number, tracking_token: newToken })
      }
      setView('tracking')
      toastSuccess(
        isAppending
          ? `Menu ditambahkan ke pesanan ${data.order_number}`
          : `Pesanan ${data.order_number} berhasil dibuat`
      )
      window.scrollTo({ top: 0 })
    } catch (err) {
      setCheckoutError(extractCheckoutError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewOrder = () => {
    try {
      sessionStorage.removeItem(ORDER_STORAGE_KEY)
    } catch {
      // abaikan jika sessionStorage tidak tersedia.
    }
    setTrackingToken(null)
    setOrderMeta(null)
    setCheckoutError(null)
    setView('menu')
    window.scrollTo({ top: 0 })
  }

  const handleAddMenu = (existingOrder) => {
    if (existingOrder) {
      setOrderMeta({
        customer_name: existingOrder.customer_name,
        payment_method: existingOrder.payment_method || 'cash',
        order_number: existingOrder.order_number,
        tracking_token: existingOrder.tracking_token || trackingToken,
      })
    }
    setCheckoutError(null)
    setView('menu')
    window.scrollTo({ top: 0 })
  }

  const content = () => {
    if (trackingToken && view === 'tracking') {
      return (
        <OrderTrackingView
          trackingToken={trackingToken}
          onNewOrder={handleNewOrder}
          onAddMenu={handleAddMenu}
        />
      )
    }
    if (tableError) {
      return (
        <ErrorState
          title="Tidak dapat membuka menu"
          message={tableError}
          onRetry={tableId ? retryTable : undefined}
        />
      )
    }
    if (tableLoading) {
      return <LoadingState label="Memuat meja Anda…" />
    }
    if (view === 'checkout') {
      return (
        <CheckoutView
          table={table}
          items={cart.items}
          total={cart.total}
          isAppending={Boolean(trackingToken)}
          existingOrderNumber={orderMeta?.order_number || trackingToken}
          onBack={() => setView('menu')}
          onSubmit={handleSubmitOrder}
          submitting={submitting}
          error={checkoutError}
          onClearError={() => setCheckoutError(null)}
        />
      )
    }
    return (
      <>
        <MenuView
          table={table}
          cartItems={cart.items}
          onSelectProduct={(product) => setDetailProductId(product.id)}
          onAddProduct={handleAddProduct}
        />
        <CartBar
          count={cart.count}
          total={cart.total}
          onClick={() => setCartOpen(true)}
        />
      </>
    )
  }

  return (
    <div className="app-shell">
      {content()}

<CartDrawer
          open={cartOpen}
          items={cart.items}
          total={cart.total}
          onClose={() => setCartOpen(false)}
          onUpdateQty={cart.updateQuantity}
          onRemove={cart.removeItem}
          onSetNotes={cart.setItemNotes}
          onCheckout={() => {
            setCartOpen(false)
            setView('checkout')
            window.scrollTo({ top: 0 })
          }}
        />

      <ProductDetailSheet
        key={detailProductId ?? 'closed'}
        open={Boolean(detailProductId)}
        productId={detailProductId}
        onClose={() => setDetailProductId(null)}
        onAdd={handleAddProduct}
      />
    </div>
  )
}

function extractCheckoutError(error) {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      const fields = error.fieldErrors
      if (fields) {
        const first = Object.values(fields)[0]
        if (Array.isArray(first) && first.length > 0) return first[0]
      }
      return 'Data pesanan tidak valid. Silakan periksa kembali.'
    }
    return error.message
  }
  return 'Terjadi kesalahan saat memproses pesanan. Silakan coba lagi.'
}

export default App
