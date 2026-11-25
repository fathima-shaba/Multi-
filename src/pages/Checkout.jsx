import ProductImage from '../components/ProductImage';
import { formatPaise, useCommerceQuery } from '../api/commerce';
import { accountRequest } from '../api/account';
import { payWithRazorpay } from '../api/razorpay';
import PriceDetails from '../components/PriceDetails';
import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import CatalogState from '../components/CatalogState';
import './Checkout.css';

export default function Checkout() {
  const { cartItems, quote, cartLoading, cartError, refresh } = useCart();
  const { user } = useAuth();
  const { retryCatalog } = useShop();
  const addresses = useCommerceQuery('/addresses');
  const gateway = useCommerceQuery('/payments/razorpay/config');
  const [paymentMethod,setPaymentMethod] = useState('demo_cod');
  const [onlineOrderId,setOnlineOrderId] = useState(null);
  const [paymentMessage,setPaymentMessage] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const checkoutAttempt = useRef(null);
  const activeRequest = useRef(false);
  const [placedOrderId, setPlacedOrderId] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(2); // 1: Login, 2: Address, 3: Summary, 4: Payment
  
  const [formData, setFormData] = useState({
    name: user ? user.name : '',
    phone: user.phone || '',
    pincode: '',
    locality: '',
    address: '',
    city: '',
    state: ''
  });

  if (placedOrderId) {
    return <Navigate to={'/orders/' + encodeURIComponent(placedOrderId)} replace />;
  }

  if (cartLoading || cartError) return <CatalogState loading={cartLoading} error={cartError} retry={refresh} label="Checking your cart…" />;

  if (cartItems.length === 0) {
    return <Navigate to="/cart" />;
  }

  if (cartItems.some(item => !item.valid)) return (
    <div className="checkout-page container">
      <p role="alert">Availability changed. Update your cart to continue.</p>
      <Link className="btn btn-primary" to="/cart">Back to Cart</Link>
      <Link className="btn btn-outline" to="/orders">View Pending Payments</Link>
    </div>
  );

  const pricing = quote.totals;
  const savedAddress = addresses.data?.addresses.find(address => address.id === selectedAddress);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    setActiveStep(3);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (activeRequest.current) return;
    setOrderError('');
    if (selectedAddress && !savedAddress) {
      setOrderError('Choose a shipping address again.');
      setActiveStep(2);
      return;
    }
    const shipping = savedAddress ? { addressId: savedAddress.id } : {
      address: { recipient: formData.name, phone: formData.phone, addressLine: formData.address,
        locality: formData.locality, city: formData.city, state: formData.state, pincode: formData.pincode },
    };
    const payload = { ...shipping, quoteVersion: quote.quoteVersion };
    const fingerprint = JSON.stringify([paymentMethod,payload]);
    if (checkoutAttempt.current?.fingerprint !== fingerprint) {
      checkoutAttempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    activeRequest.current = true;
    setSubmitting(true);
    try {
      const request = { method:'POST',body:{...payload,idempotencyKey:checkoutAttempt.current.key} };
      let result;
      if (paymentMethod==='razorpay') {
        setPaymentMessage('Reserving stock and opening Razorpay Test Mode…');
        result = await accountRequest('/payments/razorpay/order',request);
        setOnlineOrderId(result.orderId);
        try {
          await payWithRazorpay(result,()=>setPaymentMessage('Verifying payment with Razorpay…'));
        } catch(error) {
          if (error.code==='PAYMENT_FAILED') {
            try { await accountRequest('/orders/'+result.orderId+'/payment/check',{method:'POST'}); }
            catch { /* The signed webhook or a later status check can reconcile the payment. */ }
          }
          throw error;
        }
      } else {
        result = await accountRequest('/checkout',request);
      }
      setPlacedOrderId(result.orderId);
      refresh();
      retryCatalog();
    } catch (error) {
      setOrderError(error.message);
      if (error.code === 'QUOTE_CHANGED' || error.code === 'STOCK_UNAVAILABLE') refresh();
    } finally {
      activeRequest.current = false;
      setSubmitting(false);
      setPaymentMessage('');
    }
  };

  return (
    <div className="checkout-page container">
      <div className="checkout-layout">
        
        <div className="checkout-accordion">
          {/* STEP 1: LOGIN */}
          <div className="accordion-step card">
            <div className="step-header">
              <div className="step-number">1</div>
              <div className="step-title-block">
                <span className="step-title">LOGIN</span>
                {activeStep > 1 && <span className="step-summary"> {user.name}</span>}
              </div>
            </div>
          </div>

          {/* STEP 2: DELIVERY ADDRESS */}
          <div className="accordion-step card">
            <div className={`step-header ${activeStep === 2 ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-title-block">
                <span className="step-title">DELIVERY ADDRESS</span>
                {activeStep > 2 && <span className="step-summary">{savedAddress ? [savedAddress.recipient, savedAddress.addressLine, savedAddress.city, savedAddress.pincode].join(', ') : [formData.name, formData.address, formData.city, formData.pincode].join(', ')}</span>}
              </div>
              {activeStep > 2 && <button className="btn-change" onClick={() => setActiveStep(2)}>CHANGE</button>}
            </div>
            {activeStep === 2 && (
              <div className="step-content">
                <form onSubmit={handleAddressSubmit} className="address-form">
                  {addresses.loading && <p role="status">Loading saved addresses…</p>}
                  {addresses.error && <p role="alert">Saved addresses could not be loaded. <button type="button" className="btn btn-outline" onClick={addresses.retry}>Retry</button></p>}
                  {addresses.data?.addresses.length > 0 && <label>Shipping address
                    <select className="input" value={selectedAddress} onChange={event => setSelectedAddress(event.target.value)}>
                      <option value="">Enter a new address</option>
                      {addresses.data.addresses.map(address => <option key={address.id} value={address.id}>{address.recipient} · {address.addressLine}, {address.pincode}</option>)}
                    </select>
                  </label>}
                  {!selectedAddress && <div className="grid grid-cols-2 gap-4">
                    <input type="text" name="name" placeholder="Name" aria-label="Name" className="input" value={formData.name} onChange={handleChange} required />
                    <input type="tel" name="phone" inputMode="numeric" pattern="[0-9]{10}" placeholder="10-digit mobile number" aria-label="10-digit mobile number" className="input" value={formData.phone} onChange={handleChange} required />
                    <input type="text" name="pincode" inputMode="numeric" pattern="[0-9]{6}" placeholder="Pincode" aria-label="Pincode" className="input" value={formData.pincode} onChange={handleChange} required />
                    <input type="text" name="locality" placeholder="Locality" aria-label="Locality" className="input" value={formData.locality} onChange={handleChange} />
                    <textarea name="address" placeholder="Address (Area and Street)" aria-label="Address (Area and Street)" className="input col-span-2" rows="3" value={formData.address} onChange={handleChange} required></textarea>
                    <input type="text" name="city" placeholder="City/District/Town" aria-label="City/District/Town" className="input" value={formData.city} onChange={handleChange} required />
                    <input type="text" name="state" placeholder="State" aria-label="State" className="input" value={formData.state} onChange={handleChange} required />
                  </div>}
                  <div className="form-actions mt-4">
                    <button type="submit" className="btn btn-warning action-btn lg">DELIVER HERE</button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* STEP 3: ORDER SUMMARY */}
          <div className="accordion-step card">
            <div className={`step-header ${activeStep === 3 ? 'active' : ''}`}>
              <div className="step-number">3</div>
              <div className="step-title-block">
                <span className="step-title">ORDER SUMMARY</span>
                {activeStep > 3 && <span className="step-summary">{pricing.quantity} Items</span>}
              </div>
              {activeStep > 3 && <button className="btn-change" onClick={() => setActiveStep(3)}>CHANGE</button>}
            </div>
            {activeStep === 3 && (
              <div className="step-content no-padding">
                <div className="checkout-items-list">
                  {cartItems.map(item => (
                    <div key={item.id} className="checkout-item-row">
                      <ProductImage src={item.image} alt={item.name} className="checkout-item-img" />
                      <div className="checkout-item-details">
                        <h4>{item.name}</h4>
                        <p className="seller">Seller: {item.sellerName || 'MultiStore'}</p>
                        <p>Quantity: {item.quantity} · Line total: {formatPaise(item.lineTotalPaise)}</p>
                        <div className="price-line">
                          {item.originalPricePaise > item.pricePaise && <span className="mrp">{formatPaise(item.originalPricePaise)}</span>}
                          <span className="price">{formatPaise(item.pricePaise)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="step-footer">
                  <button className="btn btn-warning action-btn" onClick={() => setActiveStep(4)}>CONTINUE</button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 4: PAYMENT OPTIONS */}
          <div className="accordion-step card">
            <div className={`step-header ${activeStep === 4 ? 'active' : ''}`}>
              <div className="step-number">4</div>
              <div className="step-title-block">
                <span className="step-title">PAYMENT OPTIONS</span>
              </div>
            </div>
            {activeStep === 4 && (
              <div className="step-content">
                <form onSubmit={handlePaymentSubmit}>
                  <p>No real payment will be collected.</p>
                  <div className="payment-options">
                    <label className="payment-radio"><input type="radio" name="method" checked={paymentMethod==='demo_cod'}
                      disabled={submitting} onChange={()=>setPaymentMethod('demo_cod')} /> Demo Cash on Delivery</label>
                    <label className="payment-radio"><input type="radio" name="method" checked={paymentMethod==='razorpay'}
                      disabled={submitting||!gateway.data?.available} onChange={()=>setPaymentMethod('razorpay')} /> Razorpay Test Mode</label>
                  </div>
                  {!gateway.loading&&!gateway.data?.available&&<p>Razorpay Test Mode is unavailable. You can use Demo Cash on Delivery.</p>}
                  {paymentMessage&&<p role="status">{paymentMessage}</p>}
                  <button type="submit" disabled={submitting} className="btn btn-warning action-btn lg w-full mt-4">
                    {submitting ? 'Please wait…' : (paymentMethod==='razorpay'?'PAY IN TEST MODE':'PLACE ORDER')+' · '+formatPaise(pricing.totalPaise)}
                  </button>
                  {orderError && <p role="alert">{orderError}</p>}
                  {onlineOrderId && <Link to={'/orders/'+onlineOrderId}>Manage pending online payment</Link>}
                  {orderError && !onlineOrderId && <Link to="/orders">Order History</Link>}
                </form>
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar - Price Details */}
        <div className="checkout-summary-col">
          <PriceDetails totals={pricing} checkout />
        </div>
      </div>
    </div>
  );
}
