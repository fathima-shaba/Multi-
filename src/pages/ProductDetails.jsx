import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, CheckCircle, XCircle, Star } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useCart } from '../context/CartContext';
import ReviewSection from '../components/ReviewSection';
import './ProductDetails.css';

export default function ProductDetails() {
  const { id } = useParams();
  const { products } = useShop();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  const product = products.find(p => p.id === id);

  if (!product) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h2>Product not found</h2>
        <Link to="/shop" className="btn btn-outline" style={{ marginTop: '1rem' }}>
          Back to Shop
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  return (
    <div className="product-details-page container">
      <Link to="/shop" className="back-link">
        <ArrowLeft size={18} /> Back to Shop
      </Link>

      <div className="product-main-card card">
        <div className="product-image-container">
          <img src={product.image} alt={product.name} className="detail-image" />
        </div>
        
        <div className="product-info-container">
          <div className="category-badge">{product.category}</div>
          <h1 className="detail-title">{product.name}</h1>
          
          <div className="detail-meta">
            <div className="detail-rating">
              <Star size={18} className="star-icon" fill="currentColor" />
              <span>{product.rating > 0 ? product.rating.toFixed(1) : 'No ratings yet'}</span>
              <span className="review-count">({product.reviews?.length || 0} reviews)</span>
            </div>
            <div className={`stock-status ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {product.stock > 0 ? (
                <><CheckCircle size={16} /> In Stock ({product.stock} available)</>
              ) : (
                <><XCircle size={16} /> Out of Stock</>
              )}
            </div>
          </div>

          <p className="detail-price">${product.price.toFixed(2)}</p>
          <p className="detail-desc">{product.description}</p>

          <div className="add-to-cart-section">
            <div className="quantity-selector">
              <label>Quantity:</label>
              <input 
                type="number" 
                className="input quantity-input"
                min="1" 
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(product.stock, Math.max(1, parseInt(e.target.value) || 1)))}
                disabled={product.stock === 0}
              />
            </div>
            <button 
              className="btn btn-primary btn-lg add-btn"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              <ShoppingCart size={20} />
              {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>

      <ReviewSection productId={product.id} reviews={product.reviews} />
    </div>
  );
}
