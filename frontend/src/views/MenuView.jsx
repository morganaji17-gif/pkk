/* eslint-disable react-hooks/set-state-in-effect -- SWR cache as initial state */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getCategories, getProducts, peekCategoriesCache, peekProductsCache } from '../api/client'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import { SkeletonGrid } from '../components/Skeleton'
import TableBanner from '../components/TableBanner'
import CategoryFilter from '../components/CategoryFilter'
import ProductCard from '../components/ProductCard'

export default function MenuView({
  table,
  cartItems,
  onSelectProduct,
  onAddProduct,
}) {
  const initialCatCache = peekCategoriesCache({ per_page: 50 })
  const initialProdCache = peekProductsCache({ per_page: 50 })
  const hasInitialCache = !!(initialCatCache || initialProdCache)
  const [categories, setCategories] = useState(initialCatCache?.items || [])
  const [products, setProducts] = useState(initialProdCache?.items || [])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [loading, setLoading] = useState(!hasInitialCache)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const cachedCat = peekCategoriesCache({ per_page: 50 })
    const cachedProd = peekProductsCache({ per_page: 50 })
    const hasCached = !!(cachedCat || cachedProd)
    if (hasCached) {
      if (cachedCat) setCategories(cachedCat.items || [])
      if (cachedProd) setProducts(cachedProd.items || [])
      setError(null)
    }
    const load = async () => {
      if (!hasCached) setLoading(true)
      try {
        const [categoryRes, productRes] = await Promise.all([
          getCategories({ per_page: 50 }).catch(() => ({ items: [] })),
          getProducts({ per_page: 50 }),
        ])
        if (cancelled) return
        const categoryData = Array.isArray(categoryRes) ? categoryRes : categoryRes.items || []
        const productData = Array.isArray(productRes) ? productRes : productRes.items || []
        setCategories(categoryData)
        setProducts(productData)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (!hasCached) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const retry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((n) => n + 1)
  }

  const activeProducts = products.filter((p) => p.is_active)
  const visibleProducts =
    selectedCategory === null
      ? activeProducts
      : activeProducts.filter((p) => p.category_id === selectedCategory)

  const cartByProductId = cartItems.reduce((map, item) => {
    map[item.product.id] = item.quantity
    return map
  }, {})

  return (
    <div className="menu-page">
      <TableBanner table={table} />

      {loading && <SkeletonGrid count={6} />}

      {error && !loading && (
        <ErrorState title="Gagal memuat menu" message={error} onRetry={retry} />
      )}

      {!loading && !error && (
        <>
          {categories.length > 0 && (
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          )}

          {visibleProducts.length === 0 ? (
            <EmptyState
              icon="menu"
              title="Tidak ada menu"
              message={
                selectedCategory === null
                  ? 'Belum ada menu yang tersedia saat ini.'
                  : 'Tidak ada menu pada kategori ini.'
              }
            />
          ) : (
            <ul className="product-grid">
              {visibleProducts.map((product, index) => (
                <motion.li
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03, ease: 'easeOut' }}
                >
                  <ProductCard
                    product={product}
                    quantityInCart={cartByProductId[product.id] || 0}
                    onSelect={onSelectProduct}
                    onAdd={onAddProduct}
                  />
                </motion.li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
