import { useState } from 'react';
import { accountRequest } from '../../api/account';
import { formatPaise } from '../../api/commerce';
import { AdminModal, AdminPager, RequestStatus, useAdminData } from './catalogTools';
import { Link } from 'react-router-dom';

const statuses=['Creating','CreationUnknown','Pending','Authorized','Captured','Failed','Expired','Cancelled','RefundRequired','ReconciliationRequired','Refunded'];

export default function ManagePayments() {
  const [filters,setFilters]=useState({q:'',status:''});
  const [offset,setOffset]=useState(0);
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const listing=useAdminData('/payments?'+new URLSearchParams({...filters,offset}),revision);
  const reload=()=>setRevision(value=>value+1);

  function change(event) {
    setOffset(0);
    setFilters({...filters,[event.target.name]:event.target.value});
  }

  async function reconcile(event) {
    event.preventDefault();
    const providerOrderId=new FormData(event.currentTarget).get('providerOrderId')?.trim();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const {payment}=await accountRequest('/admin/payments/'+selected.id+'/reconcile',{
        method:'POST',body:providerOrderId?{providerOrderId}:{},
      });
      setNotice('Gateway status checked: '+payment.status+'.');
      setSelected(null);
      reload();
    } catch(failure) {
      setError(failure.message);
    } finally { setBusy(false); }
  }

  return (
    <section>
      <h1 className="page-title">Manage Payments</h1>
      <p>Razorpay transactions on this site use Test Mode.</p>
      {notice && <p role="status">{notice}</p>}
      <div className="admin-controls">
        <label>Search order or transaction<input name="q" className="input" maxLength={120} value={filters.q} onChange={change} /></label>
        <label>Status<select name="status" className="input" value={filters.status} onChange={change}>
          <option value="">All statuses</option>{statuses.map(status=><option key={status}>{status}</option>)}
        </select></label>
      </div>
      <RequestStatus {...listing} retry={reload} />
      {listing.data && <>
        <div className="card admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Order</th><th>Reference</th><th>Method</th><th>Amount</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead>
          <tbody>{listing.data.payments.map(payment=><tr key={payment.id}>
            <td><Link to={'/admin/orders?q='+encodeURIComponent(payment.orderNumber)}>{payment.orderNumber}</Link></td>
            <td>{payment.providerPaymentId || payment.providerOrderId || payment.id}</td>
            <td>{payment.provider==='razorpay'?'Razorpay Test Mode'+(payment.method?' · '+payment.method:''):'Demo Cash on Delivery'}</td>
            <td>{formatPaise(payment.amountPaise)}</td><td>{payment.status}</td>
            <td>{new Date(payment.updatedAt).toLocaleString('en-IN')}</td>
            <td>{payment.provider==='razorpay' && <button className="btn btn-outline" onClick={()=>{setError('');setSelected(payment);}}>Payment Details</button>}</td>
          </tr>)}{!listing.data.payments.length && <tr><td colSpan={7}>No matching payments.</td></tr>}</tbody>
        </table></div>
        <AdminPager offset={offset} nextOffset={listing.data.nextOffset} setOffset={setOffset} />
      </>}
      {selected && <AdminModal title="Razorpay Test Payment" busy={busy} cancel={()=>setSelected(null)}>
        <p>Internal payment: {selected.id}</p><p>Order: {selected.orderNumber}</p>
        <p>Razorpay order: {selected.providerOrderId || 'Awaiting confirmation'}</p>
        <p>Razorpay payment: {selected.providerPaymentId || '—'}</p>
        <p>{formatPaise(selected.amountPaise)} · {selected.status}</p>
        <p>Created: {new Date(selected.createdAt).toLocaleString('en-IN')}</p>
        {selected.verifiedAt && <p>Verified: {new Date(selected.verifiedAt).toLocaleString('en-IN')}</p>}
        {selected.failureReason && <p>{selected.failureReason}</p>}
        {['RefundRequired','ReconciliationRequired'].includes(selected.status) && <p>Review the payment in Razorpay Test Mode. If a full refund is needed, perform it in Razorpay and use Check Gateway Status here to verify it.</p>}
        <form className="admin-controls" onSubmit={reconcile}>
          {!selected.providerOrderId && <label>Razorpay order ID<input name="providerOrderId" className="input" pattern="order_[A-Za-z0-9]+" required /></label>}
          <button className="btn btn-primary" disabled={busy}>{busy?'Checking…':'Check Gateway Status'}</button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>setSelected(null)}>Close</button>
        </form>
        {error && <p role="alert">{error}</p>}
      </AdminModal>}
    </section>
  );
}
