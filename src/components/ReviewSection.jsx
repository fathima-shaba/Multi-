import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import './ReviewSection.css';

export default function ReviewSection({ productId, reviews }) {
  const { user } = useAuth();
  const { addReview } = useShop();
  
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    addReview(productId, {
      userId: user.id,
      userName: user.name,
      rating,
      text,
      date: new Date().toISOString()
    });

    setText('');
    setRating(5);
  };

  return (
    <div className="review-section">
      <h3>Customer Reviews ({reviews?.length || 0})</h3>
      
      {user ? (
        <form className="review-form card" onSubmit={handleSubmit}>
          <h4>Write a Review</h4>
          <div className="rating-input">
            {[1, 2, 3, 4, 5].map(star => (
              <button 
                type="button" 
                key={star}
                onClick={() => setRating(star)}
                className={`star-btn ${rating >= star ? 'active' : ''}`}
              >
                <Star size={24} fill={rating >= star ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <div className="input-group">
            <textarea 
              className="input review-textarea"
              placeholder="Share your thoughts about this product..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              rows="3"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Send size={18} /> Submit Review
          </button>
        </form>
      ) : (
        <div className="login-prompt card">
          <p>Please log in to write a review.</p>
        </div>
      )}

      <div className="reviews-list">
        {reviews?.length > 0 ? (
          reviews.map(review => (
            <div key={review.id} className="review-card card">
              <div className="review-header">
                <span className="reviewer-name">{review.userName}</span>
                <div className="review-rating">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      size={14} 
                      className={i < review.rating ? 'star-filled' : 'star-empty'} 
                      fill={i < review.rating ? 'currentColor' : 'none'} 
                    />
                  ))}
                </div>
              </div>
              <p className="review-text">{review.text}</p>
              {review.date && (
                <span className="review-date">
                  {new Date(review.date).toLocaleDateString()}
                </span>
              )}
            </div>
          ))
        ) : (
          <p className="no-reviews">No reviews yet. Be the first to review this product!</p>
        )}
      </div>
    </div>
  );
}
