import { Link, Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import './Admin.css';

export default function AdminLayout() {
  const { user, isAdmin } = useAuth();

  if (!user || !isAdmin) {
    return <Navigate to="/" />;
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar card">
        <h2 className="admin-title">Admin Panel</h2>
        <nav className="admin-nav">
          <Link to="/admin" className="admin-nav-link">
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          <Link to="/admin/products" className="admin-nav-link">
            <Package size={20} /> Manage Products
          </Link>
          <Link to="/admin/orders" className="admin-nav-link">
            <ShoppingCart size={20} /> Manage Orders
          </Link>
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export function Dashboard() {
  const { products, orders } = useShop();

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalOrders = orders.length;
  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.stock <= 5).length;

  return (
    <div className="admin-dashboard">
      <h1 className="page-title" style={{ marginBottom: '2rem' }}>Dashboard Overview</h1>
      
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="stat-card card">
          <div className="stat-icon bg-primary-light">
            <ShoppingCart size={24} />
          </div>
          <div className="stat-details">
            <h3>Total Orders</h3>
            <p className="stat-value">{totalOrders}</p>
          </div>
        </div>
        
        <div className="stat-card card">
          <div className="stat-icon bg-success-light">
            <LayoutDashboard size={24} />
          </div>
          <div className="stat-details">
            <h3>Revenue</h3>
            <p className="stat-value">${totalRevenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon bg-warning-light">
            <Package size={24} />
          </div>
          <div className="stat-details">
            <h3>Total Products</h3>
            <p className="stat-value">{totalProducts}</p>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon bg-danger-light">
            <Package size={24} />
          </div>
          <div className="stat-details">
            <h3>Low Stock Items</h3>
            <p className="stat-value">{lowStockProducts}</p>
          </div>
        </div>
      </div>

      <div className="recent-orders card">
        <h3>Recent Orders</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 5).map(order => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{new Date(order.date).toLocaleDateString()}</td>
                <td>${order.total.toFixed(2)}</td>
                <td>
                  <span className={`badge ${
                    order.status === 'Delivered' ? 'badge-success' : 
                    order.status === 'Cancelled' ? 'badge-danger' : 
                    'badge-warning'
                  }`}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center' }}>No orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
