import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronDown, Star } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import ProductCard from '../components/ProductCard';
import './Shop.css';

export default function Shop() {
  const { products, categories } = useShop();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const categoryParam = searchParams.get('category') || 'All';
  const [sortBy, setSortBy] = useState('Popularity');
  
  // Advanced Filter States
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [minRating, setMinRating] = useState(0);
  const [minDiscount, setMinDiscount] = useState(0);
  const [selectedBrands, setSelectedBrands] = useState([]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (categoryParam !== 'All') {
      result = result.filter(p => p.category === categoryParam);
    }

    // Apply Filters
    result = result.filter(p => p.price >= minPrice && p.price <= maxPrice);
    if (minRating > 0) result = result.filter(p => p.rating >= minRating);
    if (minDiscount > 0) result = result.filter(p => p.discount >= minDiscount);
    if (selectedBrands.length > 0) result = result.filter(p => selectedBrands.includes(p.brand));

    // Sorting
    switch (sortBy) {
      case 'Price -- Low to High':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'Price -- High to Low':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'Newest First':
        result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      default: // Popularity / Relevance
        result.sort((a, b) => (b.reviews?.length || 0) - (a.reviews?.length || 0));
        break;
    }

    return result;
  }, [products, categoryParam, sortBy, minPrice, maxPrice, minRating, minDiscount, selectedBrands]);

  // Extract unique brands for the current category
  const availableBrands = useMemo(() => {
    const catProducts = categoryParam === 'All' ? products : products.filter(p => p.category === categoryParam);
    const brands = new Set(catProducts.map(p => p.brand));
    return Array.from(brands).slice(0, 5); // limit to 5 for sidebar
  }, [products, categoryParam]);

  const handleCategoryChange = (cat) => {
    if (cat === 'All') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
    setSelectedBrands([]); // reset brand filter on category change
  };

  const toggleBrand = (brand) => {
    setSelectedBrands(prev => 
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  return (
    <div className="shop-page container">
      
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/">Home</Link> / 
        {categoryParam !== 'All' ? <span className="current"> {categoryParam}</span> : <span className="current"> Shop</span>}
      </div>

      {/* Category Header */}
      {categoryParam !== 'All' && (
        <div className="category-header">
          <h1>{categoryParam}</h1>
          <p className="category-desc">Explore the latest {categoryParam.toLowerCase()} and discover top brands.</p>
          <div className="category-chips">
            {['All', 'Trending', 'New Arrivals', 'Bestsellers', 'Under ₹999'].map(chip => (
              <span key={chip} className="chip">{chip}</span>
            ))}
          </div>
        </div>
      )}

      <div className="shop-layout">
        
        {/* Left Sidebar - Filters */}
        <aside className="shop-sidebar card">
          <div className="sidebar-header">
            <h2>Filters</h2>
            <button className="clear-btn" onClick={() => {
              setMinPrice(0); setMaxPrice(100000); setMinRating(0); setMinDiscount(0); setSelectedBrands([]);
            }}>CLEAR ALL</button>
          </div>

          <div className="filter-section">
            <h3 className="filter-title">CATEGORIES</h3>
            <ul className="filter-list">
              <li className={categoryParam === 'All' ? 'active' : ''} onClick={() => handleCategoryChange('All')}>All Products</li>
              {categories.map(cat => (
                <li key={cat} 
                    className={categoryParam === cat ? 'active' : ''} 
                    onClick={() => handleCategoryChange(cat)}>
                  {cat}
                </li>
              ))}
            </ul>
          </div>

          <div className="filter-section">
            <h3 className="filter-title">PRICE</h3>
            <div className="price-inputs">
              <select className="price-select" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))}>
                <option value={0}>Min</option>
                <option value={500}>₹500</option>
                <option value={1000}>₹1000</option>
                <option value={2000}>₹2000</option>
                <option value={5000}>₹5000</option>
              </select>
              <span>to</span>
              <select className="price-select" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
                <option value={1000}>₹1000</option>
                <option value={2000}>₹2000</option>
                <option value={5000}>₹5000</option>
                <option value={10000}>₹10000</option>
                <option value={100000}>10000+</option>
              </select>
            </div>
          </div>

          {availableBrands.length > 0 && (
            <div className="filter-section">
              <h3 className="filter-title flex-between">BRAND <ChevronDown size={16}/></h3>
              <div className="checkbox-group">
                {availableBrands.map(brand => (
                  <label key={brand} className="checkbox-label">
                    <input type="checkbox" checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} />
                    <span>{brand}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="filter-section">
            <h3 className="filter-title flex-between">CUSTOMER RATINGS <ChevronDown size={16}/></h3>
            <div className="checkbox-group">
              {[4, 3, 2].map(star => (
                <label key={star} className="checkbox-label">
                  <input type="checkbox" checked={minRating === star} onChange={() => setMinRating(minRating === star ? 0 : star)} />
                  <span>{star} <Star size={12} fill="currentColor"/> & above</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <h3 className="filter-title flex-between">DISCOUNT <ChevronDown size={16}/></h3>
            <div className="checkbox-group">
              {[50, 40, 30, 20, 10].map(disc => (
                <label key={disc} className="checkbox-label">
                  <input type="checkbox" checked={minDiscount === disc} onChange={() => setMinDiscount(minDiscount === disc ? 0 : disc)} />
                  <span>{disc}% or more</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content - Products */}
        <main className="shop-main">
          
          <div className="shop-topbar card">
            <div className="product-count">
              <h2>{categoryParam === 'All' ? 'All Products' : categoryParam}</h2>
              <span className="count-text">(Showing 1 – {filteredProducts.length} products)</span>
            </div>
            
            <div className="sort-bar">
              <span className="sort-label">Sort By</span>
              {['Popularity', 'Price -- Low to High', 'Price -- High to Low', 'Newest First'].map(sortOption => (
                <button 
                  key={sortOption}
                  className={`sort-tab ${sortBy === sortOption ? 'active' : ''}`}
                  onClick={() => setSortBy(sortOption)}
                >
                  {sortOption}
                </button>
              ))}
            </div>
          </div>

          <div className="product-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            ) : (
              <div className="no-results-premium card">
                <img src="https://source.unsplash.com/random/400x300?empty,box,illustration" alt="No products found" className="empty-illustration" />
                <h2>No products found</h2>
                <p>We couldn't find products matching your current filters.</p>
                <div className="empty-actions">
                  <button className="btn btn-primary" onClick={() => {
                    setMinPrice(0); setMaxPrice(100000); setMinRating(0); setMinDiscount(0); setSelectedBrands([]);
                  }}>Clear Filters</button>
                  <button className="btn btn-outline" onClick={() => handleCategoryChange('All')}>Explore All Products</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
