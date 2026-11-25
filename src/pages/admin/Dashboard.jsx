import { NavLink, Outlet } from 'react-router-dom';
import { Activity, BarChart3, Boxes, CreditCard, FileDown, Layers, LayoutDashboard, Package, ShoppingCart, Star, Users } from 'lucide-react';
import './Admin.css';

const sections = [
  ['', 'Dashboard', LayoutDashboard], ['products', 'Manage Products', Package],
  ['categories', 'Manage Categories', Layers], ['customers', 'Manage Customers', Users],
  ['orders', 'Manage Orders', ShoppingCart], ['inventory', 'Inventory', Boxes],
  ['payments', 'Manage Payments', CreditCard], ['reviews', 'Manage Reviews', Star],
  ['analytics', 'Sales Analytics', BarChart3], ['reports', 'CSV Reports', FileDown],
  ['activity', 'Activity History', Activity],
];

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar card">
        <h2 className="admin-title">Admin Panel</h2>
        <nav className="admin-nav" aria-label="Administrator">
          {sections.map(([path, label, Icon]) => (
            <NavLink key={path} end={!path} to={path ? '/admin/' + path : '/admin'} className="admin-nav-link">
              <Icon size={20} aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-main"><Outlet /></div>
    </div>
  );
}
