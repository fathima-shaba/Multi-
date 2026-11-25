import { useEffect,useState } from 'react';
import { Star } from 'lucide-react';
import { Link,useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { useCommerceQuery } from '../api/commerce';
import CatalogState from './CatalogState';
import ReviewEditor from './ReviewEditor';
import OwnReviewActions from './OwnReviewActions';
import './ReviewSection.css';

export default function ReviewSection({productId}) {
  const {user,loading}=useAuth();
  const {retryCatalog}=useShop();
  const location=useLocation();
  const [sort,setSort]=useState('newest');
  const [offset,setOffset]=useState(0);
  const [notice,setNotice]=useState('');
  const path='/products/'+encodeURIComponent(productId);
  const summary=useCommerceQuery(path+'/review-summary');
  const listing=useCommerceQuery(path+'/reviews?'+new URLSearchParams({sort,offset}));
  const eligibility=useCommerceQuery(user?path+'/review-eligibility':null);
  const own=eligibility.data?.review;

  useEffect(()=>{
    if (location.hash==='#customer-reviews') document.getElementById('customer-reviews')?.scrollIntoView();
  },[location.hash]);

  function changed(message) {
    setNotice(message);setOffset(0);summary.retry();listing.retry();eligibility.retry();retryCatalog();
  }

  return (
    <section className="review-section" id="customer-reviews">
      <h3>Customer Reviews{summary.data?' ('+summary.data.summary.count+')':''}</h3>
      <CatalogState loading={summary.loading} error={summary.error} retry={summary.retry} label="Loading rating distribution…" />
      {summary.data&&<div className="review-summary card">
        <h4>{summary.data.summary.count ? summary.data.summary.average.toFixed(1)+' / 5 average' : 'No ratings yet'}</h4>
        <p>{summary.data.summary.count} published {summary.data.summary.count===1?'review':'reviews'}</p>
        {[5,4,3,2,1].map(star=><div className="review-distribution" key={star}>
          <span>{star} stars</span><progress aria-label={star+' star reviews'} value={summary.data.summary.distribution[star]}
            max={Math.max(1,summary.data.summary.count)} /><span>{summary.data.summary.distribution[star]}</span>
        </div>)}
      </div>}
      {notice&&<p role="status" className="review-notice">{notice}</p>}
      {loading?<p role="status">Checking sign-in…</p>:!user?<p className="login-prompt card">
        <Link to="/login" state={{from:location.pathname+'#customer-reviews'}}>Sign in</Link> to review a delivered purchase.
      </p>:<>
        <CatalogState loading={eligibility.loading} error={eligibility.error} retry={eligibility.retry} label="Checking purchase eligibility…" />
        {eligibility.data&&(own?<div className="review-card card">
          <h4>Your review</h4>
          <p>{own.rating} / 5 stars · {own.status}{own.verifiedPurchase?' · Verified Purchase':''}</p>
          <p className="review-text">{own.body}</p>
          {own.moderationReason&&<p>Moderation reason: {own.moderationReason}</p>}
          <OwnReviewActions review={own} onChanged={changed} />
        </div>:eligibility.data.canSubmit?<ReviewEditor productId={productId} onSaved={changed} />:
        <p className="login-prompt card">{eligibility.data.moderated?'A moderation decision prevents reposting a review for this product.':'A delivered, eligible purchase is required to review this product.'}</p>)}
      </>}
      <label className="review-sort">Sort reviews<select className="input" value={sort} onChange={event=>{setSort(event.target.value);setOffset(0);}}>
        <option value="newest">Newest</option><option value="highest">Highest rating</option><option value="lowest">Lowest rating</option>
      </select></label>
      <CatalogState loading={listing.loading} error={listing.error} retry={listing.retry} label="Loading customer reviews…" />
      {listing.data&&<>
        <div className="reviews-list">
          {listing.data.reviews.map(review=><article key={review.id} className="review-card card">
            <div className="review-header">
              <strong className="reviewer-name">{review.displayName}</strong>
              <span className="review-rating" aria-label={review.rating+' out of 5 stars'}>
                {[1,2,3,4,5].map(star=><Star key={star} size={14} aria-hidden="true"
                  className={star<=review.rating?'star-filled':'star-empty'} fill={star<=review.rating?'currentColor':'none'} />)}
              </span>
            </div>
            <p className="verified-purchase">Verified Purchase</p>
            <p className="review-text">{review.body}</p>
            <time className="review-date" dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString('en-IN')}</time>
          </article>)}
          {!listing.data.reviews.length&&<p className="no-reviews">No published reviews on this page.</p>}
        </div>
        {(offset>0||listing.data.nextOffset!==null)&&<div className="account-actions">
          <button className="btn btn-outline" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-5))}>Previous Reviews</button>
          <button className="btn btn-outline" disabled={listing.data.nextOffset===null} onClick={()=>setOffset(listing.data.nextOffset)}>More Reviews</button>
        </div>}
      </>}
    </section>
  );
}
