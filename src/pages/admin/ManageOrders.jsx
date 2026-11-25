import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { accountRequest } from '../../api/account';
import { formatPaise } from '../../api/commerce';
import OrderDetails from '../../components/OrderDetails';
import { useShop } from '../../context/ShopContext';
import { AdminModal, AdminPager, RequestStatus, useAdminData } from './catalogTools';

const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

export default function ManageOrders() {
  const [params]=useSearchParams();
  const [filters, setFilters] = useState({ q: params.get('q') || '', status: '' });
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const { retryCatalog } = useShop();
  const listing = useAdminData('/orders?' + new URLSearchParams({ ...filters, offset }), revision);
  const details = useAdminData(selected ? '/orders/' + selected : null, revision);
  const reload = () => setRevision(value => value + 1);

  function changeFilter(event) {
    setOffset(0);
    setFilters({ ...filters, [event.target.name]: event.target.value });
  }

  async function update(event) {
    event.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await accountRequest('/admin/orders/' + selected + '/status', { method: 'PATCH', body: { status: target } });
      setNotice('Order status updated to ' + target + '.');
      if (target === 'Cancelled') retryCatalog();
      setTarget('');
      reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="manage-orders">
      <h1 className="page-title">Manage Orders</h1>
      {notice && <p role="status">{notice}</p>}
      <div className="admin-controls">
        <label>Search orders<input className="input" name="q" value={filters.q} onChange={changeFilter} maxLength={254} /></label>
        <label>Status<select className="input" name="status" value={filters.status} onChange={changeFilter}>
          <option value="">All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}
        </select></label>
      </div>
      <RequestStatus {...listing} retry={reload} />
      {listing.data && <>
        <div className="card admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th>Payment</th><th>Actions</th></tr></thead>
          <tbody>
            {listing.data.orders.map(order => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td><td>{order.customer.name}<br />{order.customer.email}</td>
                <td>{new Date(order.createdAt).toLocaleDateString('en-IN')}</td><td>{formatPaise(order.totalPaise)}</td>
                <td>{order.status}</td><td>{order.paymentStatus}</td>
                <td><button className="btn btn-outline" onClick={() => { setSelected(order.id); setTarget(''); setError(''); }}>View Order</button></td>
              </tr>
            ))}
            {!listing.data.orders.length && <tr><td colSpan={7}>No matching orders.</td></tr>}
          </tbody>
        </table></div>
        <AdminPager offset={offset} nextOffset={listing.data.nextOffset} setOffset={setOffset} />
      </>}
      {selected && <AdminModal title="Order Details" busy={busy} cancel={() => setSelected(null)}>
        <RequestStatus {...details} retry={reload} />
        {details.data && <>
          <p className="order-number">{details.data.order.orderNumber} · {details.data.order.status}</p>
          <OrderDetails order={details.data.order} admin />
          {details.data.order.allowedStatuses.length > 0 && <form className="admin-controls" onSubmit={update}>
            <label>Next status<select className="input" value={target} onChange={event => setTarget(event.target.value)}>
              <option value="">Choose status</option>
              {details.data.order.allowedStatuses.map(status => <option key={status}>{status}</option>)}
            </select></label>
            <button className="btn btn-primary" disabled={busy || !target}>{target === 'Cancelled' ? 'Confirm Cancellation' : 'Update Status'}</button>
          </form>}
        </>}
        {error && <p role="alert">{error}</p>}
        <button className="btn btn-outline" disabled={busy} onClick={() => setSelected(null)}>Close</button>
      </AdminModal>}
    </section>
  );
}
