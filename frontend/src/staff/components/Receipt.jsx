import { formatRupiah, formatDateTime, PAYMENT_METHOD_LABELS, getOrderItems } from '../../utils/format'

export default function Receipt({ order, unpaidLabel = 'Menunggu Pembayaran' }) {
    const items = getOrderItems(order)

    const paymentMethod = PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method

    return (
        <div className="receipt">
            <div className="receipt-header">
                <h2>Pesanin</h2>
                <h2>Struk Pesanan</h2>
            </div>

            <div className="receipt-info">
                <p> 
                    <span>No. Order: </span>
                    <strong>{order.order_number}</strong>
                </p>

                <p>
                    <span>Customer: </span>
                    <strong>{order.customer_name}</strong>
                </p>
                <p>
                    <span>Meja: </span>
                    <strong>Meja {order.table?.table_number || '-'}</strong>
                </p>
                <p>
                    <span>Tanggal: </span>
                    <strong>{formatDateTime(order.created_at)}</strong>
                </p>
                </div>

                <div className="receipt-items">
                    {items.map((item) => (
                        <div key={item.id} className="receipt-item">
                            <div>
                                <strong>{item.product?.name || 'Produk'}</strong>
                                <span>{item.quantity} x {formatRupiah(item.price)}</span>
                            </div>
                            
                            <strong>
                                {formatRupiah(item.subtotal ?? Number(item.price) * item.quantity)}
                            </strong>
                        </div>
                    ))}
                </div>

                <div className="receipt-total">
                    <p>
                        <span>Total: </span>
                        <strong>{formatRupiah(order.total_price)}</strong>
                    </p>
                </div>
                    
                <div className="receipt-payment">
                    <p>
                        <span>Metode Pembayaran: </span>
                        <strong>{paymentMethod}</strong>
                    </p>

                    <p>
                        <span>Status Pembayaran: </span>
                        <strong>{order.payment_status === 'paid' ? `Lunas · ${formatDateTime(order.paid_at)}` : unpaidLabel}</strong>
                    </p>
                </div>

                <div className="receipt-footer">
                    <p>Terima kasih telah memesan di Pesanin</p>
                </div>
        </div>
    )
}
