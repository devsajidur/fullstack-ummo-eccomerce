import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { productDetail } from "../../slices/ProductDetailsSlice";
import toast from "react-hot-toast";

const Star = ({ filled, size = 18 }) => {
  return (
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
};

const RatingStars = ({ rating, size = 18 }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} filled={star <= Math.round(rating)} size={size} />
      ))}
    </div>
  );
};

const Review = ({ review }) => {
  return (
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
};

export default function Reviews() {
  const detailsProduct = useSelector(
    (state) => state.clickProductDetails.Details
  );
  const dispatch = useDispatch();
  const reviews = detailsProduct?.reviews || [];

  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;

    const total = reviews.reduce((sum, review) => {
      return sum + Number(review.rating || 0);
    }, 0);

    return total / reviews.length;
  }, [reviews]);

  function handleSubmitReview(e) {
    e.preventDefault();
    if (!reviewerName.trim() || !comment.trim()) return;

    const newReview = {
      id: Date.now(),
      reviewerName: reviewerName.trim(),
      rating: Number(rating),
      comment: comment.trim(),
      date: new Date().toISOString(),
    };

    const updatedProduct = {
      ...detailsProduct,
      reviews: [newReview, ...reviews],
    };

    dispatch(productDetail(updatedProduct));
    setReviewerName("");
    setComment("");
    setRating(5);
    toast.success("Thank you! Your review has been published.");
  }

  return (
    <section className="w-full font-jost">
      {/* Rating Summary */}
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

      {/* Reviews List */}
      <div className="mb-12">
        {reviews.map((review, index) => (
          <Review key={review.id || index} review={review} />
        ))}
      </div>

      {/* Write a Review Form */}
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
