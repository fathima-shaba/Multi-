import { Link } from 'react-router-dom';
import { Package, Mail, Briefcase, HelpCircle, Gift } from 'lucide-react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-links-grid">
          
          <div className="footer-col">
            <h3>ABOUT</h3>
            <ul>
              <li><Link to="/about">Contact Us</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/about">Careers</Link></li>
              <li><Link to="/about">MultiStore Stories</Link></li>
              <li><Link to="/about">Press</Link></li>
              <li><Link to="/about">Corporate Information</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>HELP</h3>
            <ul>
              <li><Link to="/help">Payments</Link></li>
              <li><Link to="/help">Shipping</Link></li>
              <li><Link to="/help">Cancellation & Returns</Link></li>
              <li><Link to="/help">FAQ</Link></li>
              <li><Link to="/help">Report Infringement</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>CONSUMER POLICY</h3>
            <ul>
              <li><Link to="/policy">Cancellation & Returns</Link></li>
              <li><Link to="/policy">Terms Of Use</Link></li>
              <li><Link to="/policy">Security</Link></li>
              <li><Link to="/policy">Privacy</Link></li>
              <li><Link to="/policy">Sitemap</Link></li>
              <li><Link to="/policy">Grievance Redressal</Link></li>
              <li><Link to="/policy">EPR Compliance</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>SOCIAL</h3>
            <ul>
              <li><a href="#">Facebook</a></li>
              <li><a href="#">Twitter</a></li>
              <li><a href="#">YouTube</a></li>
            </ul>
          </div>
          
          <div className="footer-col footer-contact-col border-left">
            <h3>Mail Us:</h3>
            <p className="contact-address">
              MultiStore Internet Private Limited, <br/>
              Buildings Alyssa, Begonia & <br/>
              Clove Embassy Tech Village, <br/>
              Outer Ring Road, Devarabeesanahalli Village, <br/>
              Bengaluru, 560103, <br/>
              Karnataka, India
            </p>
          </div>

          <div className="footer-col footer-contact-col">
            <h3>Registered Office Address:</h3>
            <p className="contact-address">
              MultiStore Internet Private Limited, <br/>
              Buildings Alyssa, Begonia & <br/>
              Clove Embassy Tech Village, <br/>
              Outer Ring Road, Devarabeesanahalli Village, <br/>
              Bengaluru, 560103, <br/>
              Karnataka, India <br/>
              CIN : U51109KA2012PTC066107 <br/>
              Telephone: 044-45614700
            </p>
          </div>

        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-flex">
          <div className="footer-badges">
            <span className="badge-item"><Briefcase size={16}/> Become a Seller</span>
            <span className="badge-item"><Gift size={16}/> Gift Cards</span>
            <span className="badge-item"><HelpCircle size={16}/> Help Center</span>
          </div>
          <p className="copyright">&copy; {new Date().getFullYear()} MultiStore.com</p>
          <div className="payment-methods">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/200px-Visa_Inc._logo.svg.png" alt="Visa" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/200px-Mastercard-logo.svg.png" alt="Mastercard" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/UPI-Logo-vector.svg/200px-UPI-Logo-vector.svg.png" alt="UPI" />
          </div>
        </div>
      </div>
    </footer>
  );
}
