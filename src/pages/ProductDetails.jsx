import { formatINR } from '../utils/money';
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, Star, Search } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ReviewSection from '../components/ReviewSection';
import ProductCard from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import CatalogState from '../components/CatalogState';
import { loadProduct } from '../api/catalog';
import './ProductDetails.css';

export default function ProductDetails() {
  const { id } = useParams();
  const { products, catalogAttempt } = useShop();
  const { addToCart, cartItems, wishlist, toggleWishlist, busy } = useCart();
  const [imageIndex, setImageIndex] = useState({ id: null, position: 0 });
  const [cartNotice, setCartNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const saved = wishlist.some(item => item.id === id);
  const signIn = () => navigate('/login', { state: { from: '/product/' + encodeURIComponent(id) } });

  const [detail, setDetail] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadProduct(id, controller.signal).then(product => {
      if (!controller.signal.aborted) setDetail({ id, attempt, catalogAttempt, product });
    }).catch(error => {
      if (!controller.signal.aborted) setDetail({ id, attempt, catalogAttempt, error });
    });
    return () => controller.abort();
  }, [id, attempt, catalogAttempt]);

  const current = detail?.id === id && detail.attempt === attempt ? detail : null;
  const retry = () => setAttempt(previous => previous + 1);
  if (!current) return <CatalogState loading />;
  if (current.error && ![400, 404].includes(current.error.status)) {
    return <CatalogState error="Could not load this product. Please try again." retry={retry} />;
  }

  const product = current.product;

  if (!product) {
    return (
      <div className="container empty-state">
        <Search size={48} className="empty-icon" />
        <h2>Product not found</h2>
        <p>The item you are looking for might have been removed or is temporarily unavailable.</p>
        <Link to="/shop" className="btn btn-primary">Back to Shopping</Link>
      </div>
    );
  }

  const rating = product.rating;
  const atLimit = (cartItems.find(item => item.id === id)?.quantity || 0) >= product.stock;
  const image = product.images?.[imageIndex.id === id ? imageIndex.position : 0] || product.image;

  async function handleAddToCart(buyNow = false) {
    if (!user) return signIn();
    setAdding(true);
    setCartNotice('');
    try {
      await addToCart(product);
      if (buyNow) navigate('/cart');
    } catch (error) {
      setCartNotice(error.message);
    } finally {
      setAdding(false);
    }
  }
  
  async function handleWishlist() {
    if (!user) return signIn();
    setCartNotice('');
    try { await toggleWishlist(id); } catch (error) { setCartNotice(error.message); }
  }

  const similarProducts = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className="product-details-page container">
      
      {/* Breadcrumb */}
      <div className="breadcrumb pd-breadcrumb">
        <Link to="/">Home</Link> / <Link to={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link> / <span className="current">{product.brand}</span>
      </div>

      <div className="product-layout card">
        
        {/* Left: Image Gallery */}
        <div className="product-gallery-section">
          <div className="product-gallery">
            <div className="main-image-container">
              <ProductImage src={image} alt={product.name} className="main-image" />
              <button className="wishlist-float-btn" aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={saved} disabled={busy} onClick={handleWishlist}><Heart size={20} fill={saved ? 'currentColor' : 'none'} /></button>
            </div>
            {product.images?.length > 1 && <div className="product-thumbnails">
              {product.images.map((url, position) => <button type="button" className="btn btn-outline" key={url} aria-label={'View image ' + (position + 1)} onClick={() => setImageIndex({ id, position })}><ProductImage src={url} alt="" loading="lazy" /></button>)}
            </div>}
            <div className="gallery-actions">
              <button 
                className="btn btn-warning btn-lg action-btn"
                onClick={() => handleAddToCart()}
                disabled={atLimit || adding || busy}
              >
                <ShoppingCart size={20} /> ADD TO CART
              </button>
              <button 
                className="btn btn-primary btn-lg action-btn buy-now-btn"
                onClick={() => handleAddToCart(true)}
                disabled={atLimit || adding || busy}
              >
                BUY NOW
              </button>
            </div>
            {cartNotice && <p role="alert">{cartNotice}</p>}
          </div>
        </div>

        {/* Right: Product Details Top Fold */}
        <div className="product-info-panel">
          <p className="detail-brand">{product.brand}</p>
          <h1 className="detail-title">{product.name}</h1>
          <p className="stock-status" role="status">{product.stock === 0 ? 'Out of stock' : product.stock + ' available'}{product.stock > 0 && atLimit ? ' · Available quantity already in cart' : ''}</p>
          
          <div className="detail-rating-row">
            <div className="rating-badge large">
              {rating > 0 ? Number(rating).toFixed(1) : 'Unrated'} <Star size={14} fill="currentColor" />
            </div>
            <span className="rating-count">{product.reviewCount ? product.reviewCount+' verified '+(product.reviewCount===1?'review':'reviews') : 'No verified reviews yet'}</span>
          </div>

          <div className="detail-price-row">
            <span className="price">{formatINR(product.price)}</span>
            {product.originalPrice > product.price && (
              <>
                <span className="mrp">{formatINR(product.originalPrice)}</span>
                <span className="discount">{product.discount}% off</span>
              </>
            )}
          </div>

          {/* Highlights & Description */}
          <div className="product-description-section">
            <div className="flex-row">
              <div className="desc-left">
                <h3>Highlights</h3>
                <ul className="highlights-list">
                  <li>Brand: {product.brand}</li>
                  <li>Category: {product.category}</li>
</ul>
              </div>
              <div className="desc-right">
                <h3>Description</h3>
                <p className="desc-text">{product.description}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      {/* Below Fold: Ratings & Reviews */}
      <div className="detailed-section card mt-4">
        <div className="section-header">
          <h2>Ratings & Reviews</h2>
        </div>
        <div className="reviews-wrapper">
          <ReviewSection key={product.id} productId={product.id} />
        </div>
      </div>

      {/* Below Fold: Similar Products */}
      {similarProducts.length > 0 && (
        <div className="detailed-section mt-4 transparent-bg">
          <div className="section-header flex-between">
            <h2>Similar Products</h2>
            <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="btn btn-primary">VIEW ALL</Link>
          </div>
          <div className="product-grid">
            {similarProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
