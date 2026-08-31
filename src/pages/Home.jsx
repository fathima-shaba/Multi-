import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import ProductCard from '../components/ProductCard';
import './Home.css';

export default function Home() {
  const { products, categories } = useShop();
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Discover the New Era of <span className="text-gradient">Online Shopping</span>
            </h1>
            <p className="hero-subtitle">
              Explore premium products across multiple categories with lightning-fast delivery and secure payments.
            </p>
            <div className="hero-actions">
              <Link to="/shop" className="btn btn-primary btn-lg">
                Shop Now <ArrowRight size={20} />
              </Link>
            </div>
          </div>
          <div className="hero-image-wrapper">
            <div className="blob-bg"></div>
            <img 
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800" 
              alt="Fashion Model" 
              className="hero-image glass"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="container">
          <div className="grid grid-cols-3 gap-8">
            <div className="feature-card card">
              <div className="feature-icon bg-primary-light">
                <Truck size={32} />
              </div>
              <h3>Free Shipping</h3>
              <p>On all orders over $100</p>
            </div>
            <div className="feature-card card">
              <div className="feature-icon bg-success-light">
                <ShieldCheck size={32} />
              </div>
              <h3>Secure Payments</h3>
              <p>100% secure payment methods</p>
            </div>
            <div className="feature-card card">
              <div className="feature-icon bg-warning-light">
                <ShoppingBag size={32} />
              </div>
              <h3>Premium Quality</h3>
              <p>Top products from best brands</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="categories-section">
        <div className="container">
          <div className="section-header flex justify-between items-center">
            <h2>Shop by Category</h2>
            <Link to="/shop" className="btn btn-outline">View All</Link>
          </div>
          <div className="category-grid">
            {categories.filter(c => c !== 'All').map((cat, index) => (
              <Link to={`/shop?category=${cat}`} key={index} className="category-card card">
                <h3>{cat}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="featured-section">
        <div className="container">
          <h2 className="section-title text-center">Trending Products</h2>
          <div className="grid grid-cols-4 gap-6">
            {featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
