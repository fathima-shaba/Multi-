import { useState } from 'react';
import { formatINR } from '../utils/money';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ProductImage from './ProductImage';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const { addToCart, cartItems, wishlist, toggleWishlist, busy } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = wishlist.some(item => item.id === product.id);
  const signIn = () => navigate('/login', { state: { from: location.pathname + location.search } });
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const atLimit = (cartItems.find(item => item.id === product.id)?.quantity || 0) >= product.stock;
  const rating = product.rating;

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // prevent navigation
    if (!user) return signIn();
    setAdding(true);
    setNotice('');
    try { await addToCart(product); }
    catch (error) { setNotice(error.message); }
    finally { setAdding(false); }
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return signIn();
    setNotice('');
    try { await toggleWishlist(product.id); } catch (error) { setNotice(error.message); }
  };

  return (
    <article className="product-card card">
      <div className="product-image-wrapper">
        <ProductImage src={product.image} alt={product.name} className="product-image" loading="lazy" />
        <button className="wishlist-btn" aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={saved} disabled={busy} onClick={handleWishlist}>
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
        {product.discount > 0 && (
          <span className="discount-badge">{product.discount}% OFF</span>
        )}
      </div>
      <div className="product-info">
        <div className="product-brand">{product.brand || 'Generic'}</div>
        <h3 className="product-name" title={product.name}><Link to={`/product/${product.id}`} className="product-card-link">{product.name}</Link></h3>
        
        <div className="product-rating-reviews">
          <div className="rating-badge">
            {rating > 0 ? Number(rating).toFixed(1) : 'Unrated'} <Star size={12} fill="currentColor" />
          </div>
          <span className="review-count">({product.reviewCount ? product.reviewCount.toLocaleString('en-IN') : 0})</span>
        </div>

        <div className="product-price-section">
          <span className="product-price">{formatINR(product.price)}</span>
          {product.originalPrice > product.price && (
            <>
              <span className="product-mrp">{formatINR(product.originalPrice)}</span>
              <span className="product-discount">{product.discount}% off</span>
            </>
          )}
        </div>
        
      </div>
      
      {product.stock === 0 && <span className="stock-status">Out of stock</span>}
      {notice && <p role="alert">{notice}</p>}
      {/* Quick Add Overlay shown on Hover */}
      <div className="product-actions-overlay">
        <button 
          className="btn btn-primary btn-add-cart" 
          onClick={handleAddToCart}
          disabled={atLimit || adding || busy}
        >
          {product.stock === 0 ? 'OUT OF STOCK' : atLimit ? 'STOCK LIMIT REACHED' : 'ADD TO CART'}
        </button>
      </div>
    </article>
  );
}
