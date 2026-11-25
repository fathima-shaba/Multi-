import { useState } from 'react';
import { formatPaise, useCommerceQuery } from '../api/commerce';
import CatalogState from '../components/CatalogState';
import { Link } from 'react-router-dom';
import { User, Package, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProfileSettings from './account/ProfileSettings';
import ShippingAddresses from './account/ShippingAddresses';
import MyReviews from './account/MyReviews';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const orders = useCommerceQuery('/orders?offset=' + offset);
  const userOrders = orders.data?.orders || [];

  return (
    <div className="profile-page container">
      <div className="profile-header card">
        <div className="profile-avatar">
          <User size={48} />
        </div>
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          {user.phone && <p>{user.phone}</p>}
          <span className="badge badge-success" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
            {user.role === 'admin' ? 'Administrator' : 'Customer'}
          </span>
        </div>
      </div>

      <div className="profile-content">
        <div className="orders-section card">
          <h3 className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
            <Package size={20} /> Order History
          </h3>

          {(orders.loading || orders.error) ? <CatalogState loading={orders.loading} error={orders.error} retry={orders.retry} /> : userOrders.length > 0 ? (
            <div className="orders-list">
              {userOrders.map(order => (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <div>
                      <Link className="order-id" to={'/orders/' + encodeURIComponent(order.id)}>{order.orderNumber}</Link>
                      <span className="order-date">
                        <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        {new Date(order.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <span className={`badge ${order.status === 'Delivered' ? 'badge-success' : order.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="order-items">
                    {order.items.map(item => <div className="order-item" key={item.productId}>
                      <span>{item.quantity}x {item.name}</span>
                      <span>{formatPaise(item.pricePaise * item.quantity)}</span>
                    </div>)}
                  </div>
                  <div className="order-footer">
                    <Link to={'/orders/' + encodeURIComponent(order.id)}>View Receipt &amp; Tracking</Link>
                    <span>Payment: {order.paymentStatus}</span>
                    <div className="order-total">
                      Total: <strong>{formatPaise(order.totalPaise)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-orders">
              <p>You haven't placed any orders yet.</p>
            </div>
          )}
        </div>
        {orders.data && (offset > 0 || orders.data.nextOffset !== null) && <div className="account-actions">
          <button className="btn btn-outline" onClick={() => setOffset(Math.max(0, offset - 25))} disabled={!offset}>Previous Orders</button>
          <button className="btn btn-outline" onClick={() => setOffset(orders.data.nextOffset)} disabled={orders.data.nextOffset === null}>More Orders</button>
        </div>}
        <ProfileSettings key={user.id} user={user} />
        <MyReviews key={'reviews-'+user.id} />
        <ShippingAddresses key={'addresses-' + user.id} />
      </div>
    </div>
  );
}
