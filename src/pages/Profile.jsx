import { Navigate } from 'react-router-dom';
import { User, MapPin, Package, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const { orders } = useShop();

  if (!user) {
    return <Navigate to="/login" />;
  }

  const userOrders = orders.filter(o => o.userId === user.id);

  return (
    <div className="profile-page container">
      <div className="profile-header card">
        <div className="profile-avatar">
          <User size={48} />
        </div>
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
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

          {userOrders.length > 0 ? (
            <div className="orders-list">
              {userOrders.map(order => (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <div>
                      <span className="order-id">{order.id}</span>
                      <span className="order-date">
                        <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        {new Date(order.date).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`badge ${order.status === 'Delivered' ? 'badge-success' : order.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="order-item">
                        <span>{item.quantity}x {item.name}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-footer">
                    <div className="order-shipping">
                      <MapPin size={14} /> 
                      {order.shippingDetails.address}, {order.shippingDetails.city} {order.shippingDetails.zipCode}
                    </div>
                    <div className="order-total">
                      Total: <strong>${order.total.toFixed(2)}</strong>
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
      </div>
    </div>
  );
}
