import { useState } from 'react';
import { accountRequest } from '../../api/account';
import { useShop } from '../../context/ShopContext';
import { AdminModal, AdminPager, RequestStatus, StockBadge, useAdminData } from './catalogTools';

export default function ManageInventory() {
  const { retryCatalog } = useShop();
  const [q, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [adjustment, setAdjustment] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const listing = useAdminData('/inventory?' + new URLSearchParams({ q, status, offset }), revision);
  const history = useAdminData('/inventory/transactions' + (historyProduct ? '?productId=' + encodeURIComponent(historyProduct.id) : ''), revision);
  const reload = () => setRevision(previous => previous + 1);

  async function adjust(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await accountRequest('/admin/inventory/adjustments', { method: 'POST',
        body: { productId: adjustment.id, delta: Number(form.get('delta')), reason: form.get('reason') } });
      setNotice(adjustment.name + ' now has ' + result.stock + ' in stock.');
      setAdjustment(null);
      reload();
      retryCatalog();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="page-title">Inventory Management</h1>
      {notice && <p role="status">{notice}</p>}
      <div className="admin-controls">
        <label>Search inventory<input className="input" value={q} onChange={event => { setQuery(event.target.value); setOffset(0); }} maxLength={120} /></label>
        <label>Stock filter<select className="input" value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}>
          <option value="all">All products</option><option value="low">Low stock</option><option value="out">Out of stock</option>
        </select></label>
      </div>
      <RequestStatus {...listing} retry={reload} />
      {listing.data && <>
        <div className="admin-controls"><span className="badge badge-warning">Low stock: {listing.data.summary.low}</span>
          <span className="badge badge-danger">Out of stock: {listing.data.summary.outOfStock}</span></div>
        <div className="card admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Actions</th></tr></thead>
          <tbody>{listing.data.products.map(product => (
            <tr key={product.id}><td>{product.name}</td><td>{product.category}</td><td><StockBadge stock={product.availableStock ?? product.stock} />{product.reservedStock>0 && <small> · {product.reservedStock} reserved</small>}</td>
              <td><div className="action-buttons">
                <button className="btn btn-outline" aria-label={'Adjust stock for ' + product.name} onClick={() => { setNotice(''); setError(''); setAdjustment(product); }}>Adjust Stock</button>
                <button className="btn btn-outline" onClick={() => setHistoryProduct(product)}>History</button>
              </div></td>
            </tr>
          ))}{!listing.data.products.length && <tr><td colSpan={4}>No matching products.</td></tr>}</tbody>
        </table></div>
        <AdminPager offset={offset} nextOffset={listing.data.nextOffset} setOffset={setOffset} />
      </>}
      <div className="admin-controls"><h2>Inventory History{historyProduct ? ' · ' + historyProduct.name : ''}</h2>
        {historyProduct && <button className="btn btn-outline" onClick={() => setHistoryProduct(null)}>Show All</button>}</div>
      <RequestStatus {...history} retry={reload} />
      {history.data && <div className="card admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Product</th><th>Change</th><th>Reason</th><th>Administrator</th><th>Date</th></tr></thead>
        <tbody>{history.data.transactions.map(entry => <tr key={entry.id}>
          <td>{entry.productName}</td><td>{entry.delta > 0 ? '+' : ''}{entry.delta}</td><td>{entry.reason}</td>
          <td>{entry.actorName || 'System'}</td><td>{new Date(entry.createdAt).toLocaleString()}</td>
        </tr>)}{!history.data.transactions.length && <tr><td colSpan={5}>No inventory movements yet.</td></tr>}</tbody>
      </table></div>}
      {adjustment && <AdminModal title="Adjust Stock" cancel={() => setAdjustment(null)} busy={busy}>
        <p>{adjustment.name} · On hand {adjustment.stock} · Reserved {adjustment.reservedStock || 0}</p>
        <form className="admin-editor" onSubmit={adjust}>
          <label>Change in units<input name="delta" type="number" step="1" className="input" required /></label>
          <label>Reason<input name="reason" className="input" minLength={3} maxLength={250} required /></label>
          {error && <p role="alert">{error}</p>}
          <div className="admin-controls"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setAdjustment(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Adjustment'}</button></div>
        </form>
      </AdminModal>}
    </section>
  );
}
