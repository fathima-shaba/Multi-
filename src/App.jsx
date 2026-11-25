import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AccountGate from './components/AccountGate';

// Customer Pages
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';

// Admin Pages
import AdminLayout from './pages/admin/Dashboard';
import Dashboard from './pages/admin/BusinessDashboard';
import ManageCustomers from './pages/admin/ManageCustomers';
import BusinessReports from './pages/admin/BusinessReports';
import AdminActivity from './pages/admin/AdminActivity';
import ManageProducts from './pages/admin/ManageProducts';
import ManageCategories from './pages/admin/ManageCategories';
import ManageInventory from './pages/admin/ManageInventory';
import ManageOrders from './pages/admin/ManageOrders';
import ManagePayments from './pages/admin/ManagePayments';
import ManageReviews from './pages/admin/ManageReviews';

import './App.css';

const SalesAnalytics = lazy(() => import('./pages/admin/SalesAnalytics'));

function App() {
  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/cart" element={<AccountGate><Cart /></AccountGate>} />
            <Route path="/wishlist" element={<AccountGate><Wishlist /></AccountGate>} />
            <Route path="/checkout" element={<AccountGate><Checkout /></AccountGate>} />
            <Route path="/profile" element={<AccountGate><Profile /></AccountGate>} />
            <Route path="/orders" element={<AccountGate><Profile /></AccountGate>} />
            <Route path="/orders/:orderId" element={<AccountGate><OrderConfirmation /></AccountGate>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/admin" element={<AccountGate admin><AdminLayout /></AccountGate>}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<ManageProducts />} />
              <Route path="categories" element={<ManageCategories />} />
              <Route path="inventory" element={<ManageInventory />} />
              <Route path="orders" element={<ManageOrders />} />
              <Route path="payments" element={<ManagePayments />} />
              <Route path="reviews" element={<ManageReviews />} />
              <Route path="customers" element={<ManageCustomers />} />
              <Route path="analytics" element={<Suspense fallback={<p role="status">Loading analytics…</p>}><SalesAnalytics /></Suspense>} />
              <Route path="reports" element={<BusinessReports />} />
              <Route path="activity" element={<AdminActivity />} />
            </Route>
            <Route path="*" element={
              <section className="container empty-state">
                <h2>Page not found</h2>
                <p>This page is unavailable. You can return to the shop to continue browsing.</p>
                <Link to="/shop" className="btn btn-primary">Back to Shopping</Link>
              </section>
            } />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
