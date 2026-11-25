import { useState } from 'react';
import { Send,Star } from 'lucide-react';
import { accountRequest } from '../api/account';
import './ReviewSection.css';

export default function ReviewEditor({ productId,review,onSaved,onCancel }) {
  const [rating,setRating]=useState(review?.rating??0);
  const [body,setBody]=useState(review?.body??'');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!rating) return setError('Select a star rating before submitting.');
    if (!body.trim()) return setError('Enter your review.');
    setSaving(true);
    setError('');
    try {
      await accountRequest(review?'/reviews/'+review.id:'/products/'+encodeURIComponent(productId)+'/reviews',
        {method:review?'PATCH':'POST',body:{rating,body}});
      onSaved(review?'Review updated.':'Review submitted.');
    } catch(failure) { setError(failure.message); }
    finally { setSaving(false); }
  }

  return <form className="review-form card" aria-label={review?'Edit review':'Write a review'} onSubmit={submit}>
    <h4>{review?'Edit Review':'Write a Review'}</h4>
    <div className="rating-input" role="group" aria-label="Star rating">
      {[1,2,3,4,5].map(star=><button type="button" className={'star-btn '+(rating>=star?'active':'')}
        key={star} aria-label={star+' stars'} aria-pressed={rating===star} disabled={saving}
        onClick={()=>setRating(star)}><Star size={24} fill={rating>=star?'currentColor':'none'} /></button>)}
    </div>
    <label>Your review<textarea className="input review-textarea" name="body" rows={3} maxLength={2000} required
      value={body} disabled={saving} onChange={event=>setBody(event.target.value)} /></label>
    {error&&<p role="alert">{error}</p>}
    <div className="account-actions">
      <button className="btn btn-primary" disabled={saving}><Send size={18} /> {saving?'Saving…':review?'Save Review':'Submit Review'}</button>
      {onCancel&&<button type="button" className="btn btn-outline" disabled={saving} onClick={onCancel}>Cancel</button>}
    </div>
  </form>;
}
