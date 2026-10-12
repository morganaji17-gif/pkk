import { formatRupiah, resolveImageUrl } from '../utils/format'

export default function ProductCard({ product, quantityInCart, onSelect, onAdd }) {
  const imageUrl = resolveImageUrl(product.image)
  const soldOut = product.stock <= 0
  const stockStatus = product.stock_status || (soldOut ? 'out' : 'normal')
  const lowStock = !soldOut && stockStatus === 'low'
  const added = quantityInCart > 0

  return (
    <article className="product-card" aria-label={product.name}>
      <button type="button" className="product-card__main" onClick={() => onSelect(product)}>
        <div className="product-card__media">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="product-card__placeholder" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                <path d="M3 11l19-9-9 19-2-8-8-2z" />
              </svg>
            </div>
          )}
          {soldOut && <span className="product-card__badge">Habis</span>}
          {lowStock && (
            <span className="product-card__badge product-card__badge--low">
              Stok Menipis
            </span>
          )}
        </div>

        <div className="product-card__info">
          <h3 className="product-card__name">{product.name}</h3>
          {product.description && (
            <p className="product-card__desc">{product.description}</p>
          )}
          <div className="product-card__row">
            <p className="product-card__price">{formatRupiah(product.price)}</p>
            <span className={`product-card__stock ${soldOut ? 'product-card__stock--out' : lowStock ? 'product-card__stock--low' : ''}`}>
              {soldOut ? 'Habis' : `Stok ${product.stock}`}
            </span>
          </div>
        </div>
      </button>

      <div className="product-card__action">
        {soldOut ? (
          <span className="btn btn--disabled">Habis</span>
        ) : added ? (
          <span className="btn btn--added">✓ Di keranjang</span>
        ) : (
          <button type="button" className="btn btn--add" onClick={() => onAdd(product)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah
          </button>
        )}
      </div>
    </article>
  )
}
