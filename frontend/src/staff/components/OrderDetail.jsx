import { formatRupiah, formatDateTime, resolveImageUrl, getOrderItems } from '../../utils/format'
import StatusBadge from './StatusBadge'
import TableStatusBadge from './TableStatusBadge'

export default function OrderDetail({ order }) {
  const items = getOrderItems(order).map((item) => ({
    id: item.id,
    name: item.product?.name || 'Produk',
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal ?? Number(item.price) * Number(item.quantity),
    notes: item.notes || null,
  }))

  return (
    <div className="staff-order-detail">
      <dl className="staff-order-detail__meta">
        <div className="staff-order-detail__row">
          <dt>Nomor Order</dt>
          <dd className="staff-order-detail__number">{order.order_number}</dd>
        </div>
        <div className="staff-order-detail__row">
          <dt>Customer</dt>
          <dd>{order.customer_name}</dd>
        </div>
        <div className="staff-order-detail__row">
          <dt>Meja</dt>
          <dd>
            Meja {order.table?.table_number || '-'}
            {order.table?.effective_status && (
              <>
                {' '}
                <TableStatusBadge status={order.table.effective_status} />
              </>
            )}
          </dd>
        </div>
        <div className="staff-order-detail__row">
          <dt>Status</dt>
          <dd>
            <StatusBadge status={order.status} />
          </dd>
        </div>
        <div className="staff-order-detail__row">
          <dt>Pembayaran</dt>
          <dd>
            {order.payment_status === 'paid' ? 'Lunas' : 'Belum dibayar'}
            {order.payment_method ? ` · ${order.payment_method.toUpperCase()}` : ''}
          </dd>
        </div>
        {(order.proof_url || order.proof_image) && (
          <div className="staff-order-detail__row">
            <dt>Bukti QRIS</dt>
            <dd>
              <a href={resolveImageUrl(order.proof_url || order.proof_image)} target="_blank" rel="noreferrer">
                Lihat bukti
              </a>
              {order.payment_reject_note ? ` · Ditolak: ${order.payment_reject_note}` : ''}
            </dd>
          </div>
        )}
        <div className="staff-order-detail__row">
          <dt>Waktu Order</dt>
          <dd>{formatDateTime(order.created_at)}</dd>
        </div>
        {order.notes && (
          <div className="staff-order-detail__row">
            <dt>Catatan</dt>
            <dd>{order.notes}</dd>
          </div>
        )}
      </dl>

      <ul className="staff-order-detail__items">
        {items.map((item) => (
          <li key={item.id} className="staff-order-detail__item">
            <div className="staff-order-detail__item-name">
              {item.name}
              <span className="staff-order-detail__item-qty"> × {item.quantity}</span>
            </div>
            <div className="staff-order-detail__item-price">
              {formatRupiah(item.subtotal)}
            </div>
            {item.notes && (
              <p className="staff-order-detail__item-note">Catatan: {item.notes}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="staff-order-detail__total">
        <span>Total</span>
        <strong>{formatRupiah(order.total_price)}</strong>
      </div>
    </div>
  )
}
