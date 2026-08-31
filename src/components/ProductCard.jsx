import { Link } from 'react-router-dom';
import { ShoppingCart, Star } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  const handleAddToCart = (e) => {
    e.preventDefault();
    addToCart(product);
  };

  return (
    <Link to={`/product/${product.id}`} className="product-card card">
      <div className="product-image-wrapper">
        <img src={product.image} alt={product.name} className="product-image" />
        {product.stock <= 5 && product.stock > 0 && (
          <span className="badge badge-warning stock-badge">Low Stock</span>
        )}
        {product.stock === 0 && (
          <span className="badge badge-danger stock-badge">Out of Stock</span>
        )}
      </div>
      <div className="product-info">
        <div className="product-meta">
          <span className="product-category">{product.category}</span>
          <div className="product-rating">
            <Star size={14} className="star-icon" fill="currentColor" />
            <span>{product.rating > 0 ? product.rating.toFixed(1) : 'New'}</span>
          </div>
        </div>
        <h3 className="product-name">{product.name}</h3>
        <p className="product-price">${product.price.toFixed(2)}</p>
        
        <button 
          className="btn btn-primary btn-add-cart" 
          onClick={handleAddToCart}
          disabled={product.stock === 0}
        >
          <ShoppingCart size={18} />
          {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </Link>
  );
}
