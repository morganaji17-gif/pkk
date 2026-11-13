import { useEffect, useState } from 'react'
import { getRestaurantTable, getTableByToken, checkout } from './api/client'
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
import { toastSuccess, toastError } from './utils/swal'

const ORDER_STORAGE_KEY = 'pesanin_tracking_token'

/**
 * Tautan meja bisa berupa:
 * - `?t=<public_token>` (format baru, tidak bisa ditebak)
 * - `?table=<id>` (format lama, tetap didukung)
 */
function getTableTargetFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('t')
  if (token) return { token, id: null }

  const raw = params.get('table')
  if (!raw) return { token: null, id: null }

  const id = Number(raw)
  return { token: null, id: Number.isInteger(id) && id > 0 ? id : null }
}

function readStoredTrackingToken() {
  try {
    return sessionStorage.getItem(ORDER_STORAGE_KEY)
  } catch {
    return null
  }
}

function App() {
  const tableTarget = getTableTargetFromUrl()
  const tableId = tableTarget.id

  const [table, setTable] = useState(null)
  const [tableError, setTableError] = useState(() =>
    tableTarget.token || tableId ? null : 'Tautan meja tidak valid.'
  )
  const [tableRetry, setTableRetry] = useState(0)
  // Token checkout jangka pendek dari backend (menggantikan kiriman ID mentah).
  const [checkoutToken, setCheckoutToken] = useState(null)

  const [trackingToken, setTrackingToken] = useState(() => readStoredTrackingToken())
  const [orderMeta, setOrderMeta] = useState(null)
  const [view, setView] = useState(() =>
    readStoredTrackingToken() ? 'tracking' : 'menu'
  )
  const [cartOpen, setCartOpen] = useState(false)
  const [detailProductId, setDetailProductId] = useState(null)
  const [menuProducts, setMenuProducts] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)

  const cart = useCart()

  const hasTableTarget = Boolean(tableTarget.token || tableId)
  const tableLoading = hasTableTarget && !table && !tableError
  // ID final: dari meja yang sudah ter-resolve (token) atau dari URL legacy.
  const resolvedTableId = table?.id ?? tableId

  useEffect(() => {
    if (!hasTableTarget) return
    let cancelled = false
    const load = async () => {
      try {
        const data = tableTarget.token
          ? await getTableByToken(tableTarget.token)
          : await getRestaurantTable(tableId)
        if (!cancelled) {
          setTable(data)
          setCheckoutToken(data?.checkout_token || null)
        }
      } catch (err) {
        if (!cancelled) setTableError(err.message)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [hasTableTarget, tableTarget.token, tableId, tableRetry])


  const retryTable = () => {
    setTable(null)
    setTableError(null)
    setTableRetry((n) => n + 1)
  }

  // Meja ditutup (maintenance / tidak tersedia) → pelanggan tidak boleh memesan.
  const orderingClosed = Boolean(table) &&
    (table.effective_status === 'maintenance' || table.is_available === false)

  /**
   * Ambil status meja terbaru dari server (dipakai sebelum checkout).
   * Mengembalikan data meja segar atau null kalau gagal.
   */
  const fetchFreshTable = async () => {
    try {
      return tableTarget.token
        ? await getTableByToken(tableTarget.token)
        : await getRestaurantTable(tableId)
    } catch {
      return null
    }
  }

  /**
   * Cek ulang status meja tanpa reload halaman. Dipakai tombol "Cek lagi"
   * saat meja berstatus maintenance, dan sebelum checkout.
   */
  const refreshTable = async () => {
    const fresh = await fetchFreshTable()
    if (!fresh) {
      toastError('Gagal memeriksa status meja. Coba lagi.')
      return
    }
    setTable(fresh)
    setCheckoutToken(fresh.checkout_token || null)
    if (fresh.effective_status === 'maintenance' || fresh.is_available === false) {
      toastError('Meja ini masih tidak menerima pesanan.')
    } else {
      toastSuccess('Meja sudah menerima pesanan lagi.')
    }
  }

  const handleAddProduct = (product, quantity = 1, selectedOptions = []) => {
    if (orderingClosed) {
      toastError('Meja ini sedang tidak menerima pesanan.')
      return
    }
    cart.addToCart(product, quantity, selectedOptions)
  }

  const handleSubmitOrder = async (customerName, paymentMethod = 'cash', orderNotes = '') => {
    if (!resolvedTableId) {
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

    // Cek ulang status meja tepat sebelum mengirim pesanan: kasir mungkin
    // baru menutup meja setelah halaman ini dibuka.
    setSubmitting(true)
    setCheckoutError(null)
    const fresh = await fetchFreshTable()
    if (fresh) {
      setTable(fresh)
      if (fresh.checkout_token) setCheckoutToken(fresh.checkout_token)
    }
    const closedNow = fresh
      ? fresh.effective_status === 'maintenance' || fresh.is_available === false
      : orderingClosed
    if (closedNow) {
      setSubmitting(false)
      setCheckoutError('Meja ini sedang tidak menerima pesanan. Silakan hubungi kasir.')
      return
    }

    const isAppending = Boolean(trackingToken)
    const resolvedName = isAppending && orderMeta ? orderMeta.customer_name : customerName
    const resolvedMethod = isAppending && orderMeta ? orderMeta.payment_method : paymentMethod
    try {
      const payload = {
        // Utamakan token; backend memvalidasi token lebih dulu dan
        // mengabaikan ID mentah bila token ada.
        checkout_token: fresh?.checkout_token || checkoutToken || undefined,
        restaurant_table_id: (fresh?.checkout_token || checkoutToken) ? undefined : resolvedTableId,
        customer_name: resolvedName,
        payment_method: resolvedMethod,
        tracking_token: isAppending ? trackingToken : undefined,
        notes: orderNotes || undefined,
        items: cart.items.map(({ product, quantity, notes, selectedOptions }) => ({
          product_id: product.id,
          quantity,
          notes: notes || undefined,
          ...(Array.isArray(selectedOptions) && selectedOptions.length > 0
            ? { selected_options: selectedOptions }
            : {}),
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
          onRetry={hasTableTarget ? retryTable : undefined}
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
          orderingDisabled={orderingClosed}
          onRefreshTable={refreshTable}
          onSelectProduct={(product) => {
            if (orderingClosed) {
              toastError('Meja ini sedang tidak menerima pesanan.')
              return
            }
            setDetailProductId(product.id)
          }}
          onProductsLoaded={setMenuProducts}
        />
        {!orderingClosed && (
          <CartBar
            count={cart.count}
            total={cart.total}
            onClick={() => setCartOpen(true)}
          />
        )}
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
        menuProducts={menuProducts}
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
