import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Heart, ShieldCheck, Truck, RefreshCcw, Star, Tag, MapPin, Search, ChevronRight } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useCart } from '../context/CartContext';
import ReviewSection from '../components/ReviewSection';
import ProductCard from '../components/ProductCard';
import './ProductDetails.css';

export default function ProductDetails() {
  const { id } = useParams();
  const { products } = useShop();
  const { addToCart } = useCart();
  const [pincode, setPincode] = useState('');

  const product = products.find(p => p.id === id);

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

  const handleAddToCart = () => {
    addToCart(product, 1);
  };
  
  const similarProducts = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className="product-details-page container">
      
      {/* Breadcrumb */}
      <div className="breadcrumb pd-breadcrumb">
        <Link to="/">Home</Link> / <Link to={`/shop?category=${product.category}`}>{product.category}</Link> / <span className="current">{product.brand}</span>
      </div>

      <div className="product-layout card">
        
        {/* Left: Image Gallery */}
        <div className="product-gallery-section">
          <div className="product-gallery">
            <div className="main-image-container">
              <img src={product.image} alt={product.name} className="main-image" />
              <button className="wishlist-float-btn"><Heart size={20} /></button>
            </div>
            <div className="gallery-actions">
              <button 
                className="btn btn-warning btn-lg action-btn"
                onClick={handleAddToCart}
                disabled={product.stock === 0}
              >
                <ShoppingCart size={20} /> ADD TO CART
              </button>
              <button 
                className="btn btn-primary btn-lg action-btn buy-now-btn"
                disabled={product.stock === 0}
              >
                BUY NOW
              </button>
            </div>
          </div>
        </div>

        {/* Right: Product Details Top Fold */}
        <div className="product-info-panel">
          <p className="detail-brand">{product.brand}</p>
          <h1 className="detail-title">{product.name}</h1>
          
          <div className="detail-rating-row">
            <div className="rating-badge large">
              {product.rating > 0 ? Number(product.rating).toFixed(1) : 'New'} <Star size={14} fill="currentColor" />
            </div>
            <span className="rating-count">{product.reviewCount?.toLocaleString() || 0} Ratings & {product.reviews?.length || 0} Reviews</span>
          </div>

          <div className="detail-price-row">
            <span className="price">₹{product.price.toLocaleString('en-IN')}</span>
            {product.originalPrice > product.price && (
              <>
                <span className="mrp">₹{product.originalPrice.toLocaleString('en-IN')}</span>
                <span className="discount">{product.discount}% off</span>
              </>
            )}
          </div>

          {/* Offers */}
          <div className="available-offers">
            <h3>Available offers</h3>
            <ul className="offer-list">
              {product.bankOffers?.map((offer, idx) => (
                <li key={idx}><Tag size={16} className="offer-icon" /> <span><strong>Bank Offer</strong> {offer} <Link to="#">T&C</Link></span></li>
              ))}
              <li><Tag size={16} className="offer-icon" /> <span><strong>Special Price</strong> Get extra 10% off (price inclusive of cashback/coupon) <Link to="#">T&C</Link></span></li>
              <li><Tag size={16} className="offer-icon" /> <span><strong>Partner Offer</strong> Sign up for MultiStore Pay Later and get free gift card <Link to="#">Know More</Link></span></li>
            </ul>
          </div>

          {/* Delivery & Services */}
          <div className="delivery-services-row">
            <div className="delivery-section">
              <h3>Delivery</h3>
              <div className="pincode-checker">
                <MapPin size={18} className="pin-icon" />
                <input 
                  type="text" 
                  placeholder="Enter Delivery Pincode" 
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                />
                <button className="check-btn">Check</button>
              </div>
              <p className="delivery-date"><strong>{product.deliveryInfo || 'Delivery by Tomorrow'}</strong> | <span className="free-text">Free</span></p>
              <p className="delivery-subtext">If ordered before 10:00 PM</p>
            </div>
            
            <div className="services-section">
              <h3>Services</h3>
              <ul className="service-list">
                <li><RefreshCcw size={18} className="service-icon" /> {product.returnPolicy || '7 Days Replacement Policy'}</li>
                <li><ShieldCheck size={18} className="service-icon" /> {product.warranty || '1 Year Warranty'}</li>
                <li><Truck size={18} className="service-icon" /> Cash on Delivery available</li>
              </ul>
            </div>
          </div>

          {/* Seller Details */}
          <div className="seller-details-section">
            <div className="seller-header">
              <h3>Seller</h3>
              <div className="seller-info-block">
                <Link to={`/seller/${product.sellerId}`} className="seller-name">{product.sellerName}</Link>
                <div className="seller-rating-pill">
                  {product.sellerRating} <Star size={12} fill="currentColor" />
                </div>
              </div>
            </div>
            <ul className="seller-benefits">
              <li>7 Days Replacement Policy</li>
              <li>GST invoice available</li>
            </ul>
          </div>

          {/* Highlights & Description */}
          <div className="product-description-section">
            <div className="flex-row">
              <div className="desc-left">
                <h3>Highlights</h3>
                <ul className="highlights-list">
                  <li>Brand: {product.brand}</li>
                  <li>Category: {product.category}</li>
                  <li>Premium Build Quality</li>
                  <li>100% Original Product</li>
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
      
      {/* Below Fold: Specifications */}
      <div className="detailed-section card mt-4">
        <div className="section-header">
          <h2>Specifications</h2>
        </div>
        <div className="specifications-table">
          <div className="spec-row">
            <div className="spec-key">In The Box</div>
            <div className="spec-value">1 {product.name}, User Manual, Warranty Card</div>
          </div>
          <div className="spec-row">
            <div className="spec-key">Model Name</div>
            <div className="spec-value">{product.brand} Premium Edition</div>
          </div>
          <div className="spec-row">
            <div className="spec-key">Color</div>
            <div className="spec-value">Standard</div>
          </div>
        </div>
      </div>

      {/* Below Fold: Ratings & Reviews */}
      <div className="detailed-section card mt-4">
        <div className="section-header">
          <h2>Ratings & Reviews</h2>
        </div>
        <div className="reviews-wrapper">
          <ReviewSection productId={product.id} reviews={product.reviews} />
        </div>
      </div>

      {/* Below Fold: Questions and Answers */}
      <div className="detailed-section card mt-4">
        <div className="section-header flex-between">
          <h2>Questions and Answers</h2>
          <Search size={20} className="text-muted" />
        </div>
        <div className="qa-list">
          <div className="qa-item">
            <p className="q-text"><strong>Q:</strong> Is this product genuine?</p>
            <p className="a-text"><strong>A:</strong> Yes, all products sold on MultiStore by verified sellers are 100% genuine.</p>
            <p className="qa-meta">Anonymous - 10 days ago</p>
          </div>
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
