import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { CheckCircle, ShieldCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import './Checkout.css';

export default function Checkout() {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const { placeOrder } = useShop();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(2); // 1: Login, 2: Address, 3: Summary, 4: Payment
  
  const [formData, setFormData] = useState({
    name: user ? user.name : '',
    phone: '9876543210',
    pincode: '',
    locality: '',
    address: '',
    city: '',
    state: ''
  });

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState(null);

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (cartItems.length === 0 && !orderPlaced) {
    return <Navigate to="/cart" />;
  }

  // Price calculations
  const totalMRP = cartItems.reduce((total, item) => total + ((item.originalPrice || item.price) * item.quantity), 0);
  const totalDiscount = cartItems.reduce((total, item) => total + (((item.originalPrice || item.price) - item.price) * item.quantity), 0);
  const finalPrice = getCartTotal();
  const deliveryCharge = finalPrice > 500 ? 0 : 40;
  const totalAmount = finalPrice + deliveryCharge;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    setActiveStep(3);
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    const newOrderId = placeOrder(user.id, cartItems, totalAmount, formData);
    setOrderId(newOrderId);
    setOrderPlaced(true);
    clearCart();
  };

  if (orderPlaced) {
    return (
      <div className="checkout-page container success-view">
        <div className="success-card card">
          <CheckCircle size={64} className="success-icon" />
          <h2>Order placed for ₹{totalAmount.toLocaleString('en-IN')}!</h2>
          <p>Your order <strong>#{orderId}</strong> is being processed.</p>
          <button className="btn btn-primary" onClick={() => navigate('/profile')}>
            Track Order
          </button>
        </div>
      </div>
    );
  }

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
                {activeStep > 1 && <span className="step-summary"> {user.name} <span>+91 {formData.phone}</span></span>}
              </div>
              {activeStep > 1 && <button className="btn-change">CHANGE</button>}
            </div>
            {activeStep === 1 && (
              <div className="step-content">
                <p>Logged in securely.</p>
                <button className="btn btn-warning action-btn" onClick={() => setActiveStep(2)}>CONTINUE CHECKOUT</button>
              </div>
            )}
          </div>

          {/* STEP 2: DELIVERY ADDRESS */}
          <div className="accordion-step card">
            <div className={`step-header ${activeStep === 2 ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-title-block">
                <span className="step-title">DELIVERY ADDRESS</span>
                {activeStep > 2 && <span className="step-summary">{formData.name}, {formData.address}, {formData.city} - {formData.pincode}</span>}
              </div>
              {activeStep > 2 && <button className="btn-change" onClick={() => setActiveStep(2)}>CHANGE</button>}
            </div>
            {activeStep === 2 && (
              <div className="step-content">
                <form onSubmit={handleAddressSubmit} className="address-form">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" name="name" placeholder="Name" className="input" value={formData.name} onChange={handleChange} required />
                    <input type="text" name="phone" placeholder="10-digit mobile number" className="input" value={formData.phone} onChange={handleChange} required />
                    <input type="text" name="pincode" placeholder="Pincode" className="input" value={formData.pincode} onChange={handleChange} required />
                    <input type="text" name="locality" placeholder="Locality" className="input" value={formData.locality} onChange={handleChange} />
                    <textarea name="address" placeholder="Address (Area and Street)" className="input col-span-2" rows="3" value={formData.address} onChange={handleChange} required></textarea>
                    <input type="text" name="city" placeholder="City/District/Town" className="input" value={formData.city} onChange={handleChange} required />
                    <input type="text" name="state" placeholder="State" className="input" value={formData.state} onChange={handleChange} required />
                  </div>
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
                {activeStep > 3 && <span className="step-summary">{cartItems.length} Items</span>}
              </div>
              {activeStep > 3 && <button className="btn-change" onClick={() => setActiveStep(3)}>CHANGE</button>}
            </div>
            {activeStep === 3 && (
              <div className="step-content no-padding">
                <div className="checkout-items-list">
                  {cartItems.map(item => (
                    <div key={item.id} className="checkout-item-row">
                      <img src={item.image} alt={item.name} className="checkout-item-img" />
                      <div className="checkout-item-details">
                        <h4>{item.name}</h4>
                        <p className="seller">Seller: {item.sellerName || 'MultiStore'}</p>
                        <div className="price-line">
                          {item.originalPrice > item.price && <span className="mrp">₹{item.originalPrice.toLocaleString()}</span>}
                          <span className="price">₹{item.price.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="step-footer">
                  <p>Order confirmation email will be sent to <strong>{user.email}</strong></p>
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
                  <div className="payment-options">
                    <label className="payment-radio">
                      <input type="radio" name="paymentMode" value="upi" /> UPI
                    </label>
                    <label className="payment-radio">
                      <input type="radio" name="paymentMode" value="card" defaultChecked /> Credit / Debit / ATM Card
                    </label>
                    <label className="payment-radio">
                      <input type="radio" name="paymentMode" value="cod" /> Cash on Delivery
                    </label>
                  </div>
                  <button type="submit" className="btn btn-warning action-btn lg w-full mt-4">
                    PAY ₹{totalAmount.toLocaleString('en-IN')}
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar - Price Details */}
        <div className="checkout-summary-col">
          <div className="price-details-card card">
            <h3 className="price-header">PRICE DETAILS</h3>
            <div className="price-row">
              <span>Price ({cartItems.length} items)</span>
              <span>₹{totalMRP.toLocaleString('en-IN')}</span>
            </div>
            <div className="price-row">
              <span>Delivery Charges</span>
              <span>{deliveryCharge === 0 ? <span className="success-text">Free</span> : `₹${deliveryCharge}`}</span>
            </div>
            
            <div className="total-amount-row">
              <span>Amount Payable</span>
              <span>₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
          
          <div className="safe-payment">
            <ShieldCheck size={24} className="shield-icon" />
            <p>Safe and Secure Payments. Easy returns. 100% Authentic products.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
