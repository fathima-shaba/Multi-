import { useShop } from '../../context/ShopContext';

export default function ManageOrders() {
  const { orders, updateOrderStatus } = useShop();

  const handleStatusChange = (orderId, newStatus) => {
    updateOrderStatus(orderId, newStatus);
  };

  return (
    <div className="manage-orders">
      <h1 className="page-title mb-8">Manage Orders</h1>

      <div className="card" style={{ padding: '1.5rem' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer ID</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td style={{ fontWeight: '500' }}>{order.id}</td>
                <td>{order.userId}</td>
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
                <td>
                  <select 
                    className="input" 
                    style={{ padding: '0.25rem 0.5rem', width: 'auto', minWidth: '120px' }}
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  >
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                  No orders have been placed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
