import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-content footer-links-grid">
        <div className="footer-col"><h3>Shop</h3><ul>
          <li><Link to="/shop">Browse products</Link></li>
          <li><Link to="/wishlist">Wishlist</Link></li>
          <li><Link to="/cart">Cart</Link></li>
        </ul></div>
        <div className="footer-col"><h3>Account</h3><ul>
          <li><Link to="/profile">My profile</Link></li>
          <li><Link to="/orders">Order history</Link></li>
        </ul></div>
        <div className="footer-col"><h3>MultiStore</h3>
          <p>BCA final-year project at MES Kalladi College.</p>
          <p>Demo checkout uses simulated COD or Razorpay Test Mode.</p>
        </div>
      </div>
    </footer>
  );
}
