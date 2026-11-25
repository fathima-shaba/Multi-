import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommerceQuery } from '../../api/commerce';
import CatalogState from '../../components/CatalogState';
import OwnReviewActions from '../../components/OwnReviewActions';
import { useShop } from '../../context/ShopContext';

export default function MyReviews() {
  const [offset,setOffset]=useState(0);
  const [eligibleOffset,setEligibleOffset]=useState(0);
  const [notice,setNotice]=useState('');
  const result=useCommerceQuery('/users/me/reviews?'+new URLSearchParams({offset,eligibleOffset}));
  const {retryCatalog}=useShop();
  function changed(message) {setNotice(message);result.retry();retryCatalog();}
  const data=result.data;
  return <section className="orders-section card" id="my-reviews">
    <h3>My Reviews</h3>
    {notice&&<p role="status">{notice}</p>}
    <CatalogState loading={result.loading} error={result.error} retry={result.retry} label="Loading your reviews…" />
    {data&&<>
      {!data.reviews.length&&<p>No submitted reviews on this page.</p>}
      <ul className="address-list">{data.reviews.map(review=><li className="review-card card" key={review.id}>
        <h4>{review.productAvailable?<Link to={'/product/'+review.productId+'#customer-reviews'}>{review.productName}</Link>:review.productName}</h4>
        <p>{review.rating} / 5 stars · {review.status}{review.verifiedPurchase?' · Verified Purchase':''}</p>
        <p className="review-text">{review.body}</p>
        {review.moderationReason&&<p>Moderation reason: {review.moderationReason}</p>}
        <OwnReviewActions review={review} onChanged={changed} />
      </li>)}</ul>
      {(offset>0||data.nextOffset!==null)&&<div className="account-actions">
        <button className="btn btn-outline" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-10))}>Previous Reviews</button>
        <button className="btn btn-outline" disabled={data.nextOffset===null} onClick={()=>setOffset(data.nextOffset)}>More Reviews</button>
      </div>}
      <h4>Delivered products eligible for review</h4>
      {!data.eligible.length?<p>No eligible products on this page.</p>:<ul className="address-list">
        {data.eligible.map(product=><li key={product.productId}><Link to={'/product/'+product.productId+'#customer-reviews'}>Review {product.productName}</Link></li>)}
      </ul>}
      {(eligibleOffset>0||data.nextEligibleOffset!==null)&&<div className="account-actions">
        <button className="btn btn-outline" disabled={!eligibleOffset} onClick={()=>setEligibleOffset(Math.max(0,eligibleOffset-10))}>Previous Products</button>
        <button className="btn btn-outline" disabled={data.nextEligibleOffset===null} onClick={()=>setEligibleOffset(data.nextEligibleOffset)}>More Products</button>
      </div>}
    </>}
  </section>;
}
