import { formatRupiah } from '../utils/format'

export default function CartBar({ count, total, onClick }) {
  if (count === 0) return null

  return (
    <div className="cart-bar">
      <div className="cart-bar__info">
        <p className="cart-bar__count">{count} item</p>
        <p className="cart-bar__total">{formatRupiah(total)}</p>
      </div>
      <button type="button" className="btn btn--primary cart-bar__cta" onClick={onClick}>
        Lihat Keranjang
      </button>
    </div>
  )
}
