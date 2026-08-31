import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { CreditCard, Truck, CheckCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import './Checkout.css';

export default function Checkout() {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const { placeOrder } = useShop();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: user ? user.name : '',
    email: user ? user.email : '',
    address: '',
    city: '',
    zipCode: '',
    cardNumber: '',
    expiry: '',
    cvv: ''
  });

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState(null);

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (cartItems.length === 0 && !orderPlaced) {
    return <Navigate to="/cart" />;
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Calculate total including shipping
    const subtotal = getCartTotal();
    const shipping = subtotal > 100 ? 0 : 10;
    const total = subtotal + shipping;

    const shippingDetails = {
      address: formData.address,
      city: formData.city,
      zipCode: formData.zipCode
    };

    const newOrderId = placeOrder(user.id, cartItems, total, shippingDetails);
    setOrderId(newOrderId);
    setOrderPlaced(true);
    clearCart();
  };

  if (orderPlaced) {
    return (
      <div className="checkout-page container success-view">
        <div className="success-card card">
          <CheckCircle size={64} className="success-icon" />
          <h2>Order Placed Successfully!</h2>
          <p>Thank you for your purchase. Your order <strong>#{orderId}</strong> is currently being processed.</p>
          <button className="btn btn-primary" onClick={() => navigate('/profile')}>
            View Order History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page container">
      <h1 className="page-title">Checkout</h1>

      <div className="checkout-layout">
        <div className="checkout-form-container">
          <form id="checkout-form" onSubmit={handleSubmit}>
            <div className="checkout-section card">
              <h3 className="flex items-center gap-2"><Truck size={20} /> Shipping Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="input-group">
                  <label>Full Name</label>
                  <input type="text" name="fullName" className="input" value={formData.fullName} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label>Email Address</label>
                  <input type="email" name="email" className="input" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Address</label>
                  <input type="text" name="address" className="input" value={formData.address} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label>City</label>
                  <input type="text" name="city" className="input" value={formData.city} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label>ZIP Code</label>
                  <input type="text" name="zipCode" className="input" value={formData.zipCode} onChange={handleChange} required />
                </div>
              </div>
            </div>

            <div className="checkout-section card">
              <h3 className="flex items-center gap-2"><CreditCard size={20} /> Payment Details (Mock)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Card Number</label>
                  <input type="text" name="cardNumber" placeholder="0000 0000 0000 0000" className="input" value={formData.cardNumber} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label>Expiry Date</label>
                  <input type="text" name="expiry" placeholder="MM/YY" className="input" value={formData.expiry} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label>CVV</label>
                  <input type="text" name="cvv" placeholder="123" className="input" value={formData.cvv} onChange={handleChange} required />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="checkout-summary card">
          <h3>Order Summary</h3>
          <div className="checkout-items">
            {cartItems.map(item => (
              <div key={item.id} className="checkout-item">
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="summary-divider"></div>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>${getCartTotal().toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>{getCartTotal() > 100 ? 'Free' : '$10.00'}</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-row total-row">
            <span>Total</span>
            <span>${(getCartTotal() + (getCartTotal() > 100 ? 0 : 10)).toFixed(2)}</span>
          </div>
          <button form="checkout-form" type="submit" className="btn btn-primary btn-block btn-pay">
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
}
