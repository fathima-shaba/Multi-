import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, ShieldCheck, Truck, RotateCcw, Award } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import ProductCard from '../components/ProductCard';
import './Home.css';

export default function Home() {
  const { products, categories } = useShop();
  const [currentBanner, setCurrentBanner] = useState(0);

  const banners = [
    '/banner.jpg',
    '/banner2.jpg',
    '/banner3.jpg'
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  // Product groups
  const dealsOfTheDay = products.filter(p => p.discount > 40).slice(0, 6);
  const electronicsDeals = products.filter(p => p.category === 'Electronics' || p.category === 'Mobiles' || p.category === 'Laptops').slice(0, 6);
  const fashionPicks = products.filter(p => p.category === 'Fashion' || p.category === "Men's Fashion" || p.category === "Women's Fashion").slice(0, 6);
  const homeEssentials = products.filter(p => p.category === 'Home & Furniture' || p.category === 'Kitchen' || p.category === 'Appliances').slice(0, 6);
  const beautyPicks = products.filter(p => p.category === 'Beauty').slice(0, 6);
  const under999 = products.filter(p => p.price < 999).slice(0, 6);
  const newArrivals = products.slice(products.length - 6).reverse();

  return (
    <div className="home-page">
      {/* Categories Showcase */}
      <section className="categories-showcase">
        <div className="container">
          <div className="category-flex">
            {categories.slice(0, 10).map((cat, index) => (
              <Link to={`/shop?category=${encodeURIComponent(cat)}`} key={index} className="category-item">
                <div className="category-icon-wrapper">
                  <img src={`https://source.unsplash.com/random/120x120?${cat.replace(' ', ',')}&sig=${index}`} alt={cat} />
                </div>
                <span className="cat-name">{cat}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Hero Banner Carousel */}
      <section className="hero-banner">
        <div className="container px-0">
          <div className="banner-container">
            <div className="banner-slider" style={{ transform: `translateX(-${currentBanner * 100}%)` }}>
              {banners.map((img, idx) => (
                <img key={idx} src={img} alt={`Premium Offer Banner ${idx + 1}`} className="main-banner" />
              ))}
            </div>
            <button className="banner-btn prev" onClick={() => setCurrentBanner((c) => (c - 1 + banners.length) % banners.length)}>
              <ChevronLeft size={24} />
            </button>
            <button className="banner-btn next" onClick={() => setCurrentBanner((c) => (c + 1) % banners.length)}>
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </section>

      {/* Trust Elements */}
      <section className="trust-elements">
        <div className="container">
          <div className="trust-grid">
            <div className="trust-item">
              <ShieldCheck size={28} className="trust-icon" />
              <div className="trust-text">
                <h4>Secure Payments</h4>
                <p>100% protected transactions</p>
              </div>
            </div>
            <div className="trust-item">
              <RotateCcw size={28} className="trust-icon" />
              <div className="trust-text">
                <h4>Easy Returns</h4>
                <p>7-day hassle-free return</p>
              </div>
            </div>
            <div className="trust-item">
              <Truck size={28} className="trust-icon" />
              <div className="trust-text">
                <h4>Fast Delivery</h4>
                <p>Delivery across India</p>
              </div>
            </div>
            <div className="trust-item">
              <Award size={28} className="trust-icon" />
              <div className="trust-text">
                <h4>Genuine Products</h4>
                <p>Sourced from verified sellers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deals of the Day */}
      {dealsOfTheDay.length > 0 && (
        <section className="featured-section">
          <div className="container">
            <div className="section-card">
              <div className="section-header-row">
                <div className="header-title-timer">
                  <h2 className="section-title">Deals of the Day</h2>
                  <div className="countdown-timer">
                    <Clock size={16} />
                    <span>03 : 42 : 18 Left</span>
                  </div>
                </div>
                <Link to="/shop" className="btn btn-primary view-all-btn">View All</Link>
              </div>
              <div className="product-slider">
                {dealsOfTheDay.map(product => (
                  <div key={product.id} className="slider-item">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Electronics Deals */}
      {electronicsDeals.length > 0 && (
        <section className="featured-section">
          <div className="container">
            <div className="section-card">
              <div className="section-header-row">
                <h2 className="section-title">Best of Electronics</h2>
                <Link to="/shop?category=Electronics" className="btn btn-primary view-all-btn">View All</Link>
              </div>
              <div className="product-slider">
                {electronicsDeals.map(product => (
                  <div key={product.id} className="slider-item">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Fashion Picks */}
      {fashionPicks.length > 0 && (
        <section className="featured-section">
          <div className="container">
            <div className="section-card">
              <div className="section-header-row">
                <h2 className="section-title">Top Picks in Fashion</h2>
                <Link to="/shop?category=Fashion" className="btn btn-primary view-all-btn">View All</Link>
              </div>
              <div className="product-slider">
                {fashionPicks.map(product => (
                  <div key={product.id} className="slider-item">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Home & Furniture */}
      {homeEssentials.length > 0 && (
        <section className="featured-section">
          <div className="container">
            <div className="section-card">
              <div className="section-header-row">
                <h2 className="section-title">Home Essentials</h2>
                <Link to="/shop?category=Home & Furniture" className="btn btn-primary view-all-btn">View All</Link>
              </div>
              <div className="product-slider">
                {homeEssentials.map(product => (
                  <div key={product.id} className="slider-item">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Under 999 */}
      {under999.length > 0 && (
        <section className="featured-section">
          <div className="container">
            <div className="section-card">
              <div className="section-header-row">
                <h2 className="section-title">Budget Buys Under ₹999</h2>
                <Link to="/shop" className="btn btn-primary view-all-btn">View All</Link>
              </div>
              <div className="product-slider">
                {under999.map(product => (
                  <div key={product.id} className="slider-item">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Beauty Picks */}
      {beautyPicks.length > 0 && (
        <section className="featured-section mb-5">
          <div className="container">
            <div className="section-card">
              <div className="section-header-row">
                <h2 className="section-title">Beauty & Personal Care</h2>
                <Link to="/shop?category=Beauty" className="btn btn-primary view-all-btn">View All</Link>
              </div>
              <div className="product-slider">
                {beautyPicks.map(product => (
                  <div key={product.id} className="slider-item">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
