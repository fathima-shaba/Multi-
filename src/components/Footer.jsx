import { Link } from 'react-router-dom';
import { Package, Mail } from 'lucide-react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-brand-col">
          <Link to="/" className="brand">
            <Package className="brand-icon" />
            <span>MultiStore</span>
          </Link>
          <p className="footer-desc">
            Your one-stop destination for premium products. We offer the best quality items at unbeatable prices.
          </p>
          <div className="social-links">
            <a href="#" className="social-link">FB</a>
            <a href="#" className="social-link">TW</a>
            <a href="#" className="social-link">IG</a>
          </div>
        </div>
        
        <div className="footer-links-col">
          <h3>Quick Links</h3>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/shop">Shop</Link></li>
            <li><Link to="/cart">Cart</Link></li>
            <li><Link to="/profile">My Account</Link></li>
          </ul>
        </div>

        <div className="footer-links-col">
          <h3>Customer Service</h3>
          <ul>
            <li><a href="#">Contact Us</a></li>
            <li><a href="#">Shipping Policy</a></li>
            <li><a href="#">Returns & Exchanges</a></li>
            <li><a href="#">FAQ</a></li>
          </ul>
        </div>
        
        <div className="footer-newsletter">
          <h3>Stay Updated</h3>
          <p>Subscribe to our newsletter for the latest products and offers.</p>
          <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
            <div className="input-group-row">
              <input type="email" placeholder="Enter your email" className="input" required />
              <button type="submit" className="btn btn-primary">
                <Mail size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} MultiStore. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
