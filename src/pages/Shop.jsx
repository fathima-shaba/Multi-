import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import ProductCard from '../components/ProductCard';
import './Shop.css';

export default function Shop() {
  const { products, categories } = useShop();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const categoryParam = searchParams.get('category') || 'All';
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');

  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by Category
    if (categoryParam !== 'All') {
      result = result.filter(p => p.category === categoryParam);
    }

    // Filter by Search Query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || 
        p.description.toLowerCase().includes(lowerQuery)
      );
    }

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      default:
        // 'featured' keeps original order
        break;
    }

    return result;
  }, [products, categoryParam, searchQuery, sortBy]);

  const handleCategoryChange = (cat) => {
    if (cat === 'All') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="shop-page container">
      <div className="shop-header">
        <h1 className="page-title">Shop</h1>
        <p className="page-subtitle">Browse our collection of premium products</p>
      </div>

      <div className="shop-layout">
        {/* Sidebar Filters */}
        <aside className="shop-sidebar card">
          <div className="sidebar-section">
            <h3 className="sidebar-title flex items-center gap-2">
              <SlidersHorizontal size={18} /> Filters
            </h3>
            
            <div className="filter-group">
              <h4>Categories</h4>
              <ul className="category-list">
                {categories.map(cat => (
                  <li key={cat}>
                    <button 
                      className={`category-btn ${categoryParam === cat ? 'active' : ''}`}
                      onClick={() => handleCategoryChange(cat)}
                    >
                      {cat}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="shop-main">
          {/* Top Bar */}
          <div className="shop-topbar card">
            <div className="search-bar">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search products..." 
                className="input search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="sort-by">
              <label>Sort by:</label>
              <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          <div className="product-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            ) : (
              <div className="no-results card">
                <h2>No products found</h2>
                <p>Try adjusting your search or filters to find what you're looking for.</p>
                <button 
                  className="btn btn-primary" 
                  style={{marginTop: '1rem'}}
                  onClick={() => {
                    setSearchQuery('');
                    handleCategoryChange('All');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
