import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Package, ShieldCheck, Search, Store, Heart, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useShop } from '../context/ShopContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { getCartCount } = useCart();
  const { categories } = useShop();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
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
          
          <div className="search-container">
            <Search size={20} className="search-icon-left" />
            <input type="text" placeholder="Search for products, brands and more" className="search-input" />
          </div>
          
          <div className="nav-actions">
            {user ? (
              <div className="dropdown">
                <button className="nav-action-btn">
                  <User size={20} />
                  <span>{user.name ? user.name.split(' ')[0] : (user.email ? user.email.split('@')[0] : 'User')}</span>
                  <ChevronDown size={14} />
                </button>
                <div className="dropdown-menu">
                  <Link to="/profile" className="dropdown-item">My Profile</Link>
                  <Link to="/orders" className="dropdown-item">Orders</Link>
                  {isAdmin && <Link to="/admin" className="dropdown-item">Admin Dashboard</Link>}
                  <button onClick={handleLogout} className="dropdown-item">Logout</button>
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

            <Link to="/seller-dashboard" className="nav-action-btn">
              <Store size={20} />
              <span>Become a Seller</span>
            </Link>

            <Link to="/wishlist" className="nav-action-btn">
              <Heart size={20} />
              <span>Wishlist</span>
            </Link>

            <Link to="/cart" className="nav-action-btn cart-link">
              <ShoppingCart size={20} />
              <span>Cart</span>
              {getCartCount() > 0 && <span className="cart-badge">{getCartCount()}</span>}
            </Link>
          </div>
        </div>
      </nav>

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
            <span className="cat-nav-link">More <ChevronDown size={14}/></span>
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
