import { useState } from 'react';
import { accountRequest } from '../../api/account';
import { useShop } from '../../context/ShopContext';
import { AdminModal,AdminPager,RequestStatus,useAdminData } from './catalogTools';

export default function ManageReviews() {
  const [filters,setFilters]=useState({q:'',rating:'',status:''});
  const [offset,setOffset]=useState(0);
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const {retryCatalog}=useShop();
  const listing=useAdminData('/reviews?'+new URLSearchParams({...filters,offset}),revision);
  const reload=()=>setRevision(value=>value+1);
  function filter(event) {
    setOffset(0);
    setFilters({...filters,[event.target.name]:event.target.value});
  }
  async function moderate(event) {
    event.preventDefault();
    const reason=new FormData(event.currentTarget).get('reason');
    setBusy(true);setError('');setNotice('');
    try {
      await accountRequest('/admin/reviews/'+selected.review.id+'/status',{method:'PATCH',body:{status:selected.status,reason}});
      setNotice('Review status updated to '+selected.status+'.');setSelected(null);reload();retryCatalog();
    } catch(failure) {setError(failure.message);}
    finally {setBusy(false);}
  }
  function open(review,status) {setError('');setSelected({review,status});}
  return <section className="manage-reviews">
    <h1 className="page-title">Manage Reviews</h1>
    {notice&&<p role="status">{notice}</p>}
    <div className="admin-controls">
      <label>Search product or customer<input className="input" name="q" value={filters.q} maxLength={120} onChange={filter} /></label>
      <label>Rating<select className="input" name="rating" value={filters.rating} onChange={filter}><option value="">All ratings</option>
        {[1,2,3,4,5].map(rating=><option key={rating} value={rating}>{rating} stars</option>)}
      </select></label>
      <label>Status<select className="input" name="status" value={filters.status} onChange={filter}><option value="">All statuses</option>
        {['Published','Hidden','Removed','Deleted'].map(status=><option key={status}>{status}</option>)}
      </select></label>
    </div>
    <RequestStatus {...listing} retry={reload} />
    {listing.data&&<>
      <div className="card admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Product and customer</th><th>Rating and review</th><th>Status</th><th>Moderation</th><th>Actions</th></tr></thead>
        <tbody>{listing.data.reviews.map(review=><tr key={review.id}>
          <td>{review.productName}<br />{review.customerName}<br /><small>{new Date(review.createdAt).toLocaleString('en-IN')}</small></td>
          <td>{review.rating} / 5<p className="review-text">{review.body||'Deleted by customer'}</p></td>
          <td>{review.status}{review.verifiedPurchase?' · Verified Purchase':''}</td>
          <td>{review.moderationReason||'—'}{review.moderatedAt&&<><br /><small>{review.moderatorName} · {new Date(review.moderatedAt).toLocaleString('en-IN')}</small></>}</td>
          <td><div className="account-actions">
            {review.status==='Published'&&<button className="btn btn-outline" onClick={()=>open(review,'Hidden')}>Hide</button>}
            {review.status==='Hidden'&&<button className="btn btn-outline" onClick={()=>open(review,'Published')}>Restore</button>}
            {['Published','Hidden'].includes(review.status)&&<button className="btn btn-outline" onClick={()=>open(review,'Removed')}>Remove</button>}
          </div></td>
        </tr>)}{!listing.data.reviews.length&&<tr><td colSpan={5}>No matching reviews.</td></tr>}</tbody>
      </table></div>
      <AdminPager offset={offset} nextOffset={listing.data.nextOffset} setOffset={setOffset} />
    </>}
    {selected&&<AdminModal title={selected.status==='Published'?'Restore review':selected.status==='Hidden'?'Hide review':'Remove review'} cancel={()=>setSelected(null)} busy={busy}>
      <p>{selected.review.productName} · {selected.review.customerName}</p>
      {selected.status==='Removed'&&<p>Removal permanently excludes this review from the storefront.</p>}
      <form className="admin-editor" onSubmit={moderate}>
        <label>Moderation reason<textarea className="input" name="reason" minLength={3} maxLength={500} required /></label>
        {error&&<p role="alert">{error}</p>}
        <div className="admin-controls"><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Confirm Moderation'}</button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>setSelected(null)}>Cancel</button></div>
      </form>
    </AdminModal>}
  </section>;
}
