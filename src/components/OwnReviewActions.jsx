import { useState } from 'react';
import { accountRequest } from '../api/account';
import ReviewEditor from './ReviewEditor';

export default function OwnReviewActions({review,onChanged}) {
  const [action,setAction]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await accountRequest('/reviews/'+review.id,{method:'DELETE'});
      setAction('');
      onChanged('Review deleted.');
    } catch(failure) {setError(failure.message);}
    finally {setBusy(false);}
  }

  return <>
    {action==='edit'?<ReviewEditor review={review} onSaved={message=>{setAction('');onChanged(message);}} onCancel={()=>setAction('')} />:
      <div className="account-actions">
        {action==='delete'?<>
          <button className="btn btn-primary" disabled={busy} onClick={remove}>Confirm Delete</button>
          <button className="btn btn-outline" disabled={busy} onClick={()=>setAction('')}>Keep Review</button>
        </>:<>
          {review.status!=='Removed'&&<button className="btn btn-outline" onClick={()=>setAction('edit')}>Edit Review</button>}
          <button className="btn btn-outline" onClick={()=>setAction('delete')}>Delete Review</button>
        </>}
        {error&&<p role="alert">{error}</p>}
      </div>}
  </>;
}
