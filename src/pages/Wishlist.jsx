import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import CatalogState from '../components/CatalogState';
import { formatPaise } from '../api/commerce';
import './Profile.css';

export default function Wishlist() {
  const { wishlist, busy, wishlistLoading, wishlistError, refresh, removeWishlist, moveWishlist } = useCart();
  const [notice, setNotice] = useState(null);
  async function change(operation, message) {
    setNotice(null);
    try { await operation(); setNotice({ text: message }); }
    catch (error) { setNotice({ text: error.message, error: true }); }
  }

  if (wishlistLoading || wishlistError) return <CatalogState loading={wishlistLoading} error={wishlistError} retry={refresh} label="Loading your wishlist…" />;
  return (
    <section className="profile-page container">
      <div className="orders-section card">
        <h1>Wishlist</h1>
        {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
        {!wishlist.length ? <p>No products saved yet. <Link to="/shop">Browse products</Link></p> :
          <ul className="address-list">{wishlist.map(product => (
            <li className="order-card" key={product.id}>
              <div className="order-header">
                {product.available ? <Link className="order-id" to={'/product/' + product.id}>{product.name}</Link> : <strong>{product.name}</strong>}
                <span>{product.available ? formatPaise(product.pricePaise) : 'Unavailable'}</span>
              </div>
              {product.available && product.stock === 0 && <p>Out of stock</p>}
              <div className="account-actions">
                <button className="btn btn-primary" disabled={busy || !product.available || product.stock === 0} onClick={() => change(() => moveWishlist(product.id), 'Moved to cart.')}>Move to Cart</button>
                <button className="btn btn-outline" disabled={busy} onClick={() => change(() => removeWishlist(product.id), 'Removed from wishlist.')}>Remove</button>
              </div>
            </li>
          ))}</ul>}
      </div>
    </section>
  );
}
