import { formatRupiah, formatDateTime } from '../../utils/format'
import StatusBadge from './StatusBadge'
import TableStatusBadge from './TableStatusBadge'

export default function OrdersTable({ orders, onSelect, emptyLabel = 'Belum ada pesanan.' }) {
  if (!orders || orders.length === 0) {
    return (
      <p className="staff-empty">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Meja</th>
            <th>Pembayaran</th>
            <th>Total</th>
            <th>Status</th>
            <th>Waktu</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={onSelect ? () => onSelect(order) : undefined}
              className={onSelect ? 'staff-table__row--clickable' : undefined}
            >
              <td className="staff-table__number" data-label="Order">{order.order_number}</td>
              <td data-label="Customer">{order.customer_name}</td>
              <td data-label="Meja">
                Meja {order.table?.table_number || '-'}
                {order.table?.effective_status && (
                  <>
                    {' '}
                    <TableStatusBadge status={order.table.effective_status} />
                  </>
                )}
              </td>
              <td data-label="Pembayaran">
                <span
                  className={`staff-badge ${
                    order.payment_status === 'paid'
                      ? 'staff-badge--completed'
                      : 'staff-badge--pending'
                  }`}
                >
                  {order.payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar'}
                </span>
              </td>
              <td className="staff-table__total" data-label="Total">
                {formatRupiah(order.total_price)}
              </td>
              <td data-label="Status">
                <StatusBadge status={order.status} />
              </td>
              <td className="staff-table__muted" data-label="Waktu">
                {formatDateTime(order.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}