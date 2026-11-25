import { formatPaise } from '../api/commerce';

export default function OrderDetails({ order, admin = false }) {
  const address = order.shippingAddress;
  return (
    <>
      <div className="order-items">
        {order.items.map(item => (
          <div className="order-item" key={item.productId}>
            <span>{item.quantity}x {item.name}</span>
            <span>{formatPaise(item.pricePaise * item.quantity)}</span>
          </div>
        ))}
        <div className="order-item"><span>Subtotal</span><span>{formatPaise(order.subtotalPaise)}</span></div>
        {order.discountPaise > 0 && <div className="order-item"><span>Discount included</span><span>{formatPaise(order.discountPaise)}</span></div>}
        <div className="order-item"><span>Delivery</span><span>{order.deliveryPaise ? formatPaise(order.deliveryPaise) : 'Free'}</span></div>
        <div className="order-item"><strong>Total</strong><strong>{formatPaise(order.totalPaise)}</strong></div>
      </div>
      {order.customer && <p>{order.customer.name} · {order.customer.email}</p>}
      <div>
        <h3>Shipping address</h3>
        <p>{address.recipient} · {address.phone}</p>
        <p>{[address.addressLine, address.locality, address.city, address.state].filter(Boolean).join(', ')} {address.pincode}</p>
      </div>
      <p>{order.paymentMethod==='razorpay'?'Razorpay Test Mode':'Demo Cash on Delivery'} · Payment {order.paymentStatus}</p>
      <section id="order-tracking">
        <h3>Order tracking</h3>
        <ol className="address-list">
          {order.timeline.map(event => <li key={event.status}>
            <strong>{event.status}</strong> · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('en-IN')}</time>
            {admin && event.actorName && <span> · {event.actorName}</span>}
          </li>)}
        </ol>
      </section>
    </>
  );
}
