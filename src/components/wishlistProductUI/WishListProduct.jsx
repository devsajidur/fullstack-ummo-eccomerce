import React from "react";
import { CiStar } from "react-icons/ci";
import { FiTrash2 } from "react-icons/fi";
import { MdOutlineShoppingBag } from "react-icons/md";
import { useDispatch } from "react-redux";
import { deleteWishEndevisual } from "../../slices/wishListSlice";
import { addToCart } from "../../slices/cartSlice";
import { getProductDiscountState } from "../../utils/discountTimer";
import Image from "../layout/common/Image";
import toast from "react-hot-toast";

const WishListProduct = ({ product }) => {
  const dispatch = useDispatch();
  const discountState = getProductDiscountState(product);

  const handleDeleteWishProduct = (item) => {
    dispatch(deleteWishEndevisual(item));
    toast("Removed from wishlist", { icon: "🗑️" });
  };

  function handleAddtoCart(Citem) {
    const latestDiscount = getProductDiscountState(Citem);
    dispatch(
      addToCart({
        id: Citem.id,
        title: Citem.title,
        price: latestDiscount.effectivePrice,
        originalPrice: latestDiscount.originalPrice,
        discountPercent: latestDiscount.discountPercent,
        discountPercentage: Citem.discountPercentage,
        discountEndTime: Citem.discountEndTime || null,
        freeGift: Citem.freeGift || null,
        image: Citem.thumbnail,
        quantity: 1,
        size: "M",
        color: "Black",
      })
    );
    toast.success(
      `"${Citem.title}" added to cart at $${latestDiscount.effectivePrice.toFixed(2)}!`
    );
  }

  const rating = Number(product?.rating || 4.8);
  const reviewCount = Array.isArray(product?.reviews)
    ? product.reviews.length
    : 1;
  const inStock = Number(product?.stock ?? 10) > 0;

  return (
    <article className="group grid grid-cols-[100px_1fr] gap-4 border-b border-gray-200 pb-5 xs:grid-cols-[130px_1fr] sm:grid-cols-[170px_1fr] sm:gap-6 lg:grid-cols-[210px_1fr]">
      {/* Image */}
      <div className="relative aspect-4/5 overflow-hidden bg-[#f5f5f5]">
        <Image
          product={product}
          src={product?.thumbnail || product?.image}
          alt={product?.title || "Product"}
          width={210}
          height={262}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Product Info */}
      <div className="flex min-w-0 flex-col justify-between py-1">
        <div>
          <div className="mb-1 flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-gray">
                {product?.category}
              </p>

              <h3 className="text-base font-medium sm:text-lg lg:text-xl">
                {product?.title}
              </h3>
            </div>

            <button
              onClick={() => handleDeleteWishProduct(product)}
              type="button"
              className="shrink-0 text-gray transition-colors hover:text-red-500"
            >
              <FiTrash2 className="cursor-pointer" size={17} strokeWidth={1.5} />
            </button>
          </div>

          {/* Rating */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, index) => (
                <CiStar
                  key={index}
                  size={13}
                  strokeWidth={1.5}
                  className={
                    index < Math.round(rating)
                      ? "fill-primary text-primary"
                      : "text-gray-300"
                  }
                />
              ))}
            </div>

            <span className="text-xs text-gray">
              {rating.toFixed(1)} ({reviewCount})
            </span>
          </div>

          {/* Price */}
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`text-base font-semibold sm:text-lg ${
                discountState.isDiscountActive
                  ? "text-[#D6001C]"
                  : "text-primary"
              }`}
            >
              ${discountState.effectivePrice.toFixed(2)}
            </span>
            {discountState.isDiscountActive && (
              <>
                <span className="text-xs text-gray-400 line-through">
                  ${discountState.originalPrice.toFixed(2)}
                </span>
                <span className="text-[10px] font-bold bg-red-50 text-[#D6001C] px-1.5 py-0.5 rounded">
                  -{discountState.discountPercent}% OFF
                </span>
              </>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-5 flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                inStock ? "bg-green-500" : "bg-red-500"
              }`}
            />

            <span className="text-xs text-gray">
              {inStock ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          <button
            onClick={() => handleAddtoCart(product)}
            type="button"
            disabled={!inStock}
            className="flex w-full cursor-pointer items-center justify-center gap-2 bg-primary px-4 py-2.5 text-xs uppercase tracking-wider text-white transition-all duration-300 hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300 xs:w-auto"
          >
            <MdOutlineShoppingBag size={15} />
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
};

export default WishListProduct;
