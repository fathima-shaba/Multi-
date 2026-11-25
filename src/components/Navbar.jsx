import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Package, Search, Heart, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useShop } from '../context/ShopContext';
import './Navbar.css';

export default function Navbar() {
  const { user, loading, logout, isAdmin } = useAuth();
  const { getCartCount } = useCart();
  const { categories } = useShop();
  const navigate = useNavigate();

  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      navigate('/');
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get('q').trim();
    navigate(q ? '/shop?' + new URLSearchParams({ q }) : '/shop');
  };

  return (
    <header className="marketplace-header">
      {/* Top Header */}
      <nav className="navbar top-navbar">
        <div className="container navbar-content">
          <Link to="/" className="brand">
            <Package className="brand-icon" />
            <span>MultiStore</span>
          </Link>
          
          <form className="search-container" role="search" onSubmit={handleSearch}>
            <button className="search-icon-left" type="submit" aria-label="Submit product search"><Search size={20} /></button>
            <input type="text" name="q" aria-label="Search products" maxLength={120} placeholder="Search for products, brands and more" className="search-input" />
          </form>
          
          <div className="nav-actions">
            {loading ? <span className="nav-action-btn" role="status"><User size={20} /></span> : user ? (
              <div className="dropdown">
                <button className="nav-action-btn" aria-label="Account menu">
                  <User size={20} />
                  <span>{user.name ? user.name.split(' ')[0] : (user.email ? user.email.split('@')[0] : 'User')}</span>
                  <ChevronDown size={14} />
                </button>
                <div className="dropdown-menu">
                  <Link to="/profile" className="dropdown-item">My Profile</Link>
                  <Link to="/orders" className="dropdown-item">Orders</Link>
                  {isAdmin && <Link to="/admin" className="dropdown-item">Admin Dashboard</Link>}
                  <button onClick={handleLogout} className="dropdown-item" disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Logout'}</button>
                </div>
              </div>
            ) : (
              <div className="dropdown">
                <Link to="/login" className="nav-action-btn login-btn">
                  <User size={20} />
                  <span>Login</span>
                </Link>
              </div>
            )}

            <Link to="/wishlist" className="nav-action-btn" aria-label="Wishlist">
              <Heart size={20} />
              <span>Wishlist</span>
            </Link>

            <Link to="/cart" className="nav-action-btn cart-link" aria-label="Cart">
              <ShoppingCart size={20} />
              <span>Cart</span>
              {getCartCount() > 0 && <span className="cart-badge">{getCartCount()}</span>}
            </Link>
          </div>
        </div>
      </nav>

      {logoutError && <p className="container" role="alert">{logoutError}</p>}

      {/* Second Navigation */}
      <div className="category-nav">
        <div className="container category-nav-content">
          <Link to="/" className="cat-nav-link active">Home</Link>
          {categories.slice(0, 11).map((cat, idx) => (
            <Link to={`/shop?category=${encodeURIComponent(cat)}`} key={idx} className="cat-nav-link">
              {cat}
            </Link>
          ))}
          <div className="dropdown">
            <button type="button" className="cat-nav-link more-categories">More <ChevronDown size={14}/></button>
            <div className="dropdown-menu">
              {categories.slice(11).map((cat, idx) => (
                <Link to={`/shop?category=${encodeURIComponent(cat)}`} key={idx} className="dropdown-item">
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
