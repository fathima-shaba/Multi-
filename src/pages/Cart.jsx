import ProductImage from '../components/ProductImage';
import { formatPaise } from '../api/commerce';
import CatalogState from '../components/CatalogState';
import PriceDetails from '../components/PriceDetails';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './Cart.css';

export default function Cart() {
  const { cartItems, quote, cartLoading, cartError, busy, refresh, updateQuantity, removeFromCart, clearCart } = useCart();
  const [quantityError, setQuantityError] = useState('');
  const navigate = useNavigate();

  if (cartLoading || cartError) return <CatalogState loading={cartLoading} error={cartError} retry={refresh} label="Loading your cart…" />;

  if (cartItems.length === 0) {
    return (
      <div className="cart-page container empty-cart">
        <div className="empty-cart-content card">
          <h2>Your cart is empty!</h2>
          <p>Add items to it now.</p>
          <Link to="/shop" className="btn btn-primary shop-now-btn">
            Shop Now
          </Link>
        </div>
      </div>
    );
  }

  const { totals } = quote;
  const blocked = busy || cartItems.some(item => !item.valid);
  async function change(operation) {
    setQuantityError('');
    try { await operation(); } catch (failure) { setQuantityError(failure.message); }
  }

  return (
    <div className="cart-page container">
      <div className="cart-layout">
        <div className="cart-left">
          {quantityError && <p role="alert">{quantityError}</p>}
          <div className="cart-header card">
            <h2>My Cart ({totals.quantity})</h2>
            <button className="btn btn-outline" disabled={busy} onClick={() => change(clearCart)}>Clear Cart</button>
          </div>
          
          <div className="cart-items-container card">
            {cartItems.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-image-col">
                  <Link to={`/product/${item.id}`}>
                    <ProductImage src={item.image} alt={item.name} />
                  </Link>
                  <div className="quantity-controls">
                    <button 
                      className="qty-btn"
                      disabled={busy}
                      onClick={() => change(() => item.quantity === 1 ? removeFromCart(item.id) : updateQuantity(item.id, item.quantity - 1))}
                    >-</button>
                    <span className="qty-value">{item.quantity}</span>
                    <button 
                      className="qty-btn"
                      onClick={() => change(() => updateQuantity(item.id, item.quantity + 1))}
                      disabled={busy || !item.available || item.quantity >= Math.min(999, item.stock)}
                    >+</button>
                  </div>
                </div>
                
                <div className="cart-item-details-col">
                  <Link to={`/product/${item.id}`} className="cart-item-title">
                    {item.name}
                  </Link>
                  <p className="seller-info">Seller: {item.sellerName || 'MultiStore Retail'}</p>
                  
                  <div className="cart-item-pricing">
                    {item.originalPricePaise > item.pricePaise && <span className="mrp">{formatPaise(item.originalPricePaise)}</span>}
                    <span className="price">{formatPaise(item.pricePaise)}</span>
                    {item.discount && <span className="discount-tag">{item.discount}% Off</span>}
                  </div>
                  
                  <p className="delivery-info">Delivery by {item.deliveryInfo || 'Tomorrow'}</p>
                  {!item.valid && <p role="alert">
                    {!item.available || item.stock === 0 ? 'Unavailable. Remove this item to continue.' : 'Only ' + item.stock + ' available. Reduce the quantity to continue.'}
                  </p>}

                  <div className="cart-item-actions-row">
                    <button className="action-link font-medium text-muted hover-danger" disabled={busy} onClick={() => change(() => removeFromCart(item.id))}>REMOVE</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cart-right">
          <PriceDetails totals={totals} />

          <button 
            className="btn btn-warning btn-block btn-checkout"
            disabled={blocked}
            onClick={() => navigate('/checkout')}
          >
            PLACE ORDER
          </button>
        </div>
      </div>
    </div>
  );
}
