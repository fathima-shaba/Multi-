import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation(); // prevent navigation
    addToCart(product);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Wishlist functionality here
  };

  return (
    <Link to={`/product/${product.id}`} className="product-card card">
      <div className="product-image-wrapper">
        <img src={product.image} alt={product.name} className="product-image" />
        <button className="wishlist-btn" onClick={handleWishlist}>
          <Heart size={18} />
        </button>
        {product.discount > 0 && (
          <span className="discount-badge">{product.discount}% OFF</span>
        )}
      </div>
      <div className="product-info">
        <div className="product-brand">{product.brand || 'Generic'}</div>
        <h3 className="product-name" title={product.name}>{product.name}</h3>
        
        <div className="product-rating-reviews">
          <div className="rating-badge">
            {product.rating > 0 ? Number(product.rating).toFixed(1) : 'New'} <Star size={12} fill="currentColor" />
          </div>
          <span className="review-count">({product.reviewCount ? product.reviewCount.toLocaleString('en-IN') : 0})</span>
        </div>

        <div className="product-price-section">
          <span className="product-price">₹{product.price.toLocaleString('en-IN')}</span>
          {product.originalPrice > product.price && (
            <>
              <span className="product-mrp">₹{product.originalPrice.toLocaleString('en-IN')}</span>
              <span className="product-discount">{product.discount}% off</span>
            </>
          )}
        </div>
        
        {product.deliveryInfo && (
          <div className="product-delivery">
            <span className="free-delivery">Free delivery</span>
          </div>
        )}
      </div>
      
      {/* Quick Add Overlay shown on Hover */}
      <div className="product-actions-overlay">
        <button 
          className="btn btn-primary btn-add-cart" 
          onClick={handleAddToCart}
          disabled={product.stock === 0}
        >
          {product.stock === 0 ? 'OUT OF STOCK' : 'ADD TO CART'}
        </button>
      </div>
    </Link>
  );
}
