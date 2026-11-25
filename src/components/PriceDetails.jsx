import { formatPaise } from '../api/commerce';

export default function PriceDetails({ totals, checkout = false }) {
  const { quantity, mrpPaise, discountPaise, subtotalPaise, deliveryPaise, totalPaise } = totals;
  return (
    <div className="price-details-card card">
      <h3 className="price-header">PRICE DETAILS</h3>
      <div className="price-row"><span>Price ({quantity} items)</span><span>{formatPaise(mrpPaise)}</span></div>
      <div className="price-row"><span>Discount</span><span className="success-text">{formatPaise(discountPaise ? -discountPaise : 0)}</span></div>
      <div className="price-row"><span>Subtotal</span><span>{formatPaise(subtotalPaise)}</span></div>
      <div className="price-row"><span>Delivery Charges</span><span>{deliveryPaise ? formatPaise(deliveryPaise) : 'Free'}</span></div>
      <div className="total-amount-row"><span>{checkout ? 'Amount Payable' : 'Total Amount'}</span><span>{formatPaise(totalPaise)}</span></div>
      {!checkout && discountPaise > 0 && <p className="savings-msg success-text">You will save {formatPaise(discountPaise)} on this order</p>}
    </div>
  );
}
