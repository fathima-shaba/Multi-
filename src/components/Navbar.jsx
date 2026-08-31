import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Package, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { getCartCount } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar glass">
      <div className="container navbar-content">
        <Link to="/" className="brand">
          <Package className="brand-icon" />
          <span>MultiStore</span>
        </Link>
        
        <div className="nav-links">
          <Link to="/shop" className="nav-link">Shop</Link>
          
          {isAdmin && (
            <Link to="/admin" className="nav-link admin-link">
              <ShieldCheck size={18} /> Admin
            </Link>
          )}

          <Link to="/cart" className="nav-link cart-link">
            <ShoppingCart size={20} />
            {getCartCount() > 0 && <span className="cart-badge">{getCartCount()}</span>}
          </Link>
          
          {user ? (
            <div className="user-menu">
              <Link to="/profile" className="nav-link">
                <User size={20} />
                <span className="user-name">{user.name}</span>
              </Link>
              <button onClick={handleLogout} className="btn-logout" title="Logout">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
