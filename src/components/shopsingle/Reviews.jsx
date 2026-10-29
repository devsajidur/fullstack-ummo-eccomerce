import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { productDetail } from "../../slices/ProductDetailsSlice";
import {
  fetchProductReviewsFromMongo,
  saveProductReviewToMongo,
} from "../../services/api";
import toast from "react-hot-toast";

const Star = ({ filled, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-primary"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3.75l2.572 5.21 5.75.836-4.16 4.054.982 5.727L12 16.875l-5.144 2.702.982-5.727-4.16-4.054 5.75-.836L12 3.75z"
    />
  </svg>
);

const RatingStars = ({ rating, size = 18 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star key={star} filled={star <= Math.round(rating)} size={size} />
    ))}
  </div>
);

const Review = ({ review }) => (
  <div className="border-b border-gray-200 py-6 last:border-b-0">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h4 className="font-jost text-sm font-medium text-primary">
          {review.reviewerName}
        </h4>
        {review.date && (
          <p className="text-[11px] text-gray">
            {new Date(review.date).toLocaleDateString()}
          </p>
        )}
      </div>
      <RatingStars rating={review.rating} size={16} />
    </div>
    <p className="mt-3 font-jost text-sm leading-6 text-gray">
      {review.comment}
    </p>
  </div>
);

export default function Reviews() {
  const detailsProduct = useSelector(
    (state) => state.clickProductDetails.Details
  );
  const dispatch = useDispatch();
  const productId = detailsProduct?.id;

  const [persistedReviews, setPersistedReviews] = useState([]);
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  // Load persisted reviews from MongoDB (`reviews/{productId}`) + localStorage fallback
  useEffect(() => {
    if (!productId) return;
    const localKey = `ummo_reviews_${productId}`;
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) setPersistedReviews(JSON.parse(cached));
    } catch {
      // ignore
    }

    fetchProductReviewsFromMongo(productId)
      .then((list) => {
        if (!Array.isArray(list) || list.length === 0) return;
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );
        setPersistedReviews(sorted);
        localStorage.setItem(localKey, JSON.stringify(sorted));
      })
      .catch(() => {});
  }, [productId]);

  const reviews = useMemo(() => {
    const base = Array.isArray(detailsProduct?.reviews)
      ? detailsProduct.reviews
      : [];
    const seen = new Set(persistedReviews.map((r) => String(r.id)));
    return [
      ...persistedReviews,
      ...base.filter((r) => !seen.has(String(r.id))),
    ];
  }, [persistedReviews, detailsProduct]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce(
      (sum, review) => sum + Number(review.rating || 0),
      0
    );
    return total / reviews.length;
  }, [reviews]);

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!reviewerName.trim() || !comment.trim() || !productId) return;

    const newReview = {
      id: Date.now(),
      reviewerName: reviewerName.trim(),
      rating: Number(rating),
      comment: comment.trim(),
      date: new Date().toISOString(),
    };

    const nextPersisted = [newReview, ...persistedReviews];
    setPersistedReviews(nextPersisted);
    localStorage.setItem(
      `ummo_reviews_${productId}`,
      JSON.stringify(nextPersisted)
    );

    try {
      await saveProductReviewToMongo(productId, newReview);
    } catch {
      // Stored locally if offline
    }

    dispatch(
      productDetail({
        ...detailsProduct,
        reviews: [newReview, ...(detailsProduct?.reviews || [])],
      })
    );
    setReviewerName("");
    setComment("");
    setRating(5);
    toast.success("Thank you! Your review has been published.");
  }

  return (
    <section className="w-full font-jost">
      <div className="mb-10 border-b border-gray-200 pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="mb-2 text-lg font-medium text-primary">
              Customer Reviews
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-medium text-primary">
                {averageRating.toFixed(1)}
              </span>
              <div>
                <RatingStars rating={averageRating} size={20} />
                <p className="mt-1 text-xs text-gray">
                  Based on {reviews.length}{" "}
                  {reviews.length === 1 ? "Review" : "Reviews"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-12">
        {reviews.map((review, index) => (
          <Review key={review.id || index} review={review} />
        ))}
      </div>

      <div className="border-t border-gray-200 pt-8">
        <h4 className="text-base font-medium text-primary mb-4">
          Write a Customer Review
        </h4>
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div>
            <label className="block text-xs text-gray mb-1.5">
              Your Rating *
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="cursor-pointer"
                >
                  <Star filled={star <= rating} size={22} />
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            required
            placeholder="Your Name *"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            className="w-full border border-gray-300 px-3.5 py-2.5 text-sm text-primary outline-none focus:border-primary"
          />

          <textarea
            rows={4}
            required
            placeholder="Share your experience with this product *"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border border-gray-300 px-3.5 py-2.5 text-sm text-primary outline-none focus:border-primary"
          />

          <button
            type="submit"
            className="bg-primary text-white text-xs uppercase tracking-wider font-medium px-8 py-3.5 cursor-pointer hover:opacity-90"
          >
            Submit Review
          </button>
        </form>
      </div>
    </section>
  );
}
