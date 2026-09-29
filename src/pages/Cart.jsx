import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ShieldCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './Cart.css';

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <div className="cart-page container empty-cart">
        <div className="empty-cart-content card">
          <img src="https://source.unsplash.com/random/300x200?empty,cart" alt="Empty Cart" className="empty-img" />
          <h2>Your cart is empty!</h2>
          <p>Add items to it now.</p>
          <Link to="/shop" className="btn btn-primary shop-now-btn">
            Shop Now
          </Link>
        </div>
      </div>
    );
  }

  // Calculations for Price Details
  const totalMRP = cartItems.reduce((total, item) => total + ((item.originalPrice || item.price) * item.quantity), 0);
  const totalDiscount = cartItems.reduce((total, item) => {
    const mrp = item.originalPrice || item.price;
    return total + ((mrp - item.price) * item.quantity);
  }, 0);
  const finalPrice = getCartTotal();
  const deliveryCharge = finalPrice > 500 ? 0 : 40;
  const totalAmount = finalPrice + deliveryCharge;

  return (
    <div className="cart-page container">
      <div className="cart-layout">
        <div className="cart-left">
          <div className="cart-header card">
            <h2>My Cart ({cartItems.length})</h2>
          </div>
          
          <div className="cart-items-container card">
            {cartItems.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-image-col">
                  <Link to={`/product/${item.id}`}>
                    <img src={item.image} alt={item.name} />
                  </Link>
                  <div className="quantity-controls">
                    <button 
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >-</button>
                    <span className="qty-value">{item.quantity}</span>
                    <button 
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                    >+</button>
                  </div>
                </div>
                
                <div className="cart-item-details-col">
                  <Link to={`/product/${item.id}`} className="cart-item-title">
                    {item.name}
                  </Link>
                  <p className="seller-info">Seller: {item.sellerName || 'MultiStore Retail'}</p>
                  
                  <div className="cart-item-pricing">
                    {item.originalPrice > item.price && <span className="mrp">₹{item.originalPrice.toLocaleString('en-IN')}</span>}
                    <span className="price">₹{item.price.toLocaleString('en-IN')}</span>
                    {item.discount && <span className="discount-tag">{item.discount}% Off</span>}
                  </div>
                  
                  <p className="delivery-info">Delivery by {item.deliveryInfo || 'Tomorrow'} | <span className="free">Free</span></p>

                  <div className="cart-item-actions-row">
                    <button className="action-link font-medium text-muted">SAVE FOR LATER</button>
                    <button className="action-link font-medium text-muted hover-danger" onClick={() => removeFromCart(item.id)}>REMOVE</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cart-right">
          <div className="price-details-card card">
            <h3 className="price-header">PRICE DETAILS</h3>
            <div className="price-row">
              <span>Price ({cartItems.length} items)</span>
              <span>₹{totalMRP.toLocaleString('en-IN')}</span>
            </div>
            <div className="price-row">
              <span>Discount</span>
              <span className="success-text">- ₹{totalDiscount.toLocaleString('en-IN')}</span>
            </div>
            <div className="price-row">
              <span>Delivery Charges</span>
              <span>{deliveryCharge === 0 ? <span className="success-text">Free</span> : `₹${deliveryCharge}`}</span>
            </div>
            
            <div className="total-amount-row">
              <span>Total Amount</span>
              <span>₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
            
            {totalDiscount > 0 && (
              <p className="savings-msg success-text font-medium">
                You will save ₹{totalDiscount.toLocaleString('en-IN')} on this order
              </p>
            )}
          </div>
          
          <div className="safe-payment">
            <ShieldCheck size={24} className="shield-icon" />
            <p>Safe and Secure Payments. Easy returns. 100% Authentic products.</p>
          </div>

          <button 
            className="btn btn-warning btn-block btn-checkout"
            onClick={() => navigate('/checkout')}
          >
            PLACE ORDER
          </button>
        </div>
      </div>
    </div>
  );
}
