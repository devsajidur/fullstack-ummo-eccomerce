import React, { useState } from "react";
import Image from "./Image";
import Flex from "./Flex";
import { FaHeart, FaRegHeart, FaStar, FaCheck } from "react-icons/fa6";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../../slices/cartSlice";
import {
  addWishList,
  deleteWishEndevisual,
} from "../../../slices/wishListSlice";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { getProductDiscountState } from "../../../utils/discountTimer";
import { classifyProductTaxonomy } from "../../../utils/categoryTaxonomy";
import { useLocalization } from "../../../i18n/LocalizationContext";

const Product = ({
  item,
  productImage,
  badgeText,
  discountBadge,
  productCatagory,
  productTitle,
  productPrice,
  id,
  priority = false,
  prioritizeFirstRow = false,
}) => {
  const isPriority = Boolean(priority || prioritizeFirstRow);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useLocalization();
  const [justAdded, setJustAdded] = useState(false);

  const wishProduct = useSelector((state) => state.wishList.wishProduct || []);
  const isWishlisted = wishProduct.some(
    (w) => String(w.id) === String(item?.id ?? id)
  );
  const stockCount = item?.stock !== undefined ? Number(item.stock) : 99;
  const isOutOfStock = stockCount <= 0;

  const discountState = getProductDiscountState({
    ...item,
    price: item?.price ?? productPrice,
    discountPercentage: item?.discountPercentage ?? discountBadge,
  });
  const effectivePrice = discountState.effectivePrice;
  const regularPrice = discountState.regularPrice;
  const activeDiscountPct = discountState.discountPercentage;

  const taxonomy = classifyProductTaxonomy(
    item || { id, title: productTitle, category: productCatagory }
  );

  const handleAddToCart = (e) => {
    e.stopPropagation();
    if (isOutOfStock) {
      toast.error(t("product.outOfStock", "Sorry, this item is currently out of stock."));
      return;
    }
    dispatch(
      addToCart({
        ...item,
        id: item?.id ?? id,
        title: item?.title ?? productTitle,
        price: regularPrice,
        discountPercentage: activeDiscountPct,
        effectivePrice,
        thumbnail: item?.thumbnail ?? productImage,
        category: item?.category ?? productCatagory,
        qun: 1,
      })
    );
    setJustAdded(true);
    toast.success(`"${productTitle}" added to cart`);
    setTimeout(() => setJustAdded(false), 1400);
  };

  const handleWishlist = (e) => {
    e.stopPropagation();
    const payload = {
      ...item,
      id: item?.id ?? id,
      title: item?.title ?? productTitle,
      price: regularPrice,
      discountPercentage: activeDiscountPct,
      effectivePrice,
      thumbnail: item?.thumbnail ?? productImage,
      category: item?.category ?? productCatagory,
      quantity: 1,
      qun: 1,
    };
    if (isWishlisted) {
      dispatch(deleteWishEndevisual(payload));
    } else {
      dispatch(addWishList(payload));
    }
    toast.success(
      isWishlisted
        ? `Removed "${productTitle}" from Wishlist`
        : `Saved "${productTitle}" to Wishlist`
    );
  };

  const handleNavigateDetail = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate(`/shop/${id}`);
  };

  const ratingValue = Math.max(
    1,
    Math.min(5, Math.round(Number(item?.rating || 4.5)))
  );

  return (
    <article className="relative group flex flex-col h-full bg-white rounded-lg overflow-hidden transition-shadow hover:shadow-md border border-transparent hover:border-gray-100">
      <div
        onClick={handleNavigateDetail}
        className="cursor-pointer relative overflow-hidden bg-[#F7F7F7] rounded-t-lg aspect-[4/5] flex items-center justify-center"
      >
        <Image
          src={productImage}
          alt={productTitle}
          width={280}
          height={340}
          loading={isPriority ? "eager" : "lazy"}
          fetchPriority={isPriority ? "high" : "auto"}
          className="w-full h-full object-contain p-3 bg-[#F7F7F7] transition-transform duration-300 group-hover:scale-105"
        />

        {/* Wishlist Heart Quick Button */}
        <button
          type="button"
          aria-label={
            isWishlisted ? "Remove from wishlist" : "Add to wishlist"
          }
          onClick={handleWishlist}
          className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center text-gray-700 hover:text-red-600 transition-colors cursor-pointer"
        >
          {isWishlisted ? (
            <FaHeart className="text-red-600 text-sm" />
          ) : (
            <FaRegHeart className="text-sm" />
          )}
        </button>

        {/* Add to Cart Bar (No ticking timer on listing cards per Gate 6) */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={`w-[calc(100%-16px)] min-h-[38px] py-2 font-bold text-[11px] sm:text-xs uppercase tracking-wider cursor-pointer rounded-md absolute bottom-2 left-2 right-2 duration-200 flex items-center justify-center gap-1.5 shadow-sm ${
            isOutOfStock
              ? "bg-gray-300 text-gray-600 cursor-not-allowed opacity-100"
              : justAdded
                ? "bg-emerald-600 text-white opacity-100"
                : "bg-white/95 hover:bg-primary hover:text-white text-primary opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          }`}
        >
          {isOutOfStock ? (
            t("product.outOfStock", "OUT OF STOCK")
          ) : justAdded ? (
            <>
              <FaCheck /> {t("product.addedToCart", "ADDED")}
            </>
          ) : (
            t("product.addToCart", "ADD TO CART")
          )}
        </button>

        {/* Top-Left Status / Discount Badges */}
        <div className="flex flex-col gap-1 absolute top-2.5 left-2.5 z-10 pointer-events-none">
          {isOutOfStock ? (
            <span className="py-1 px-2 bg-gray-900 font-bold text-[10px] uppercase tracking-wider text-white rounded">
              {t("product.outOfStock", "SOLD OUT")}
            </span>
          ) : (
            <>
              {badgeText && (
                <span className="py-0.5 px-2 bg-gray-900 font-bold text-[10px] uppercase tracking-wider text-white rounded">
                  {badgeText}
                </span>
              )}
              {discountState.isDiscountActive && (
                <span className="py-1 px-2 bg-[#C32929] font-extrabold text-[11px] text-white rounded shadow-sm">
                  -{activeDiscountPct}% {t("product.off", "OFF")}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Product Card Details */}
      <div
        onClick={handleNavigateDetail}
        className="flex flex-col flex-1 justify-between pt-2.5 pb-2 px-2 cursor-pointer"
      >
        <div>
          <Flex className="justify-between items-center gap-1">
            <span className="text-[11px] text-[#666666] font-medium uppercase tracking-wider truncate">
              {taxonomy?.departmentName || productCatagory}
            </span>
            <div
              role="img"
              className="flex items-center gap-0.5 text-[#E5A800] text-[10px] shrink-0"
              aria-label={`Rated ${ratingValue} out of 5 stars`}
            >
              {Array.from({ length: ratingValue }).map((_, idx) => (
                <FaStar key={idx} />
              ))}
            </div>
          </Flex>

          <h2 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-1 mt-1 group-hover:text-[#C32929] transition-colors">
            {productTitle}
          </h2>
        </div>

        {/* Gate 6: Clear Discount & Regular Price Hierarchy */}
        <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-baseline justify-between gap-1.5 flex-wrap">
          {discountState.isDiscountActive ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="text-sm sm:text-[15px] font-extrabold text-[#C32929]"
                data-testid="product-effective-price"
              >
                ${effectivePrice.toFixed(2)}
              </span>
              <span
                className="text-xs font-medium text-gray-600 line-through"
                data-testid="product-regular-price"
              >
                ${regularPrice.toFixed(2)}
              </span>
            </div>
          ) : (
            <span
              className="text-sm sm:text-[15px] font-bold text-gray-900"
              data-testid="product-regular-price"
            >
              ${regularPrice.toFixed(2)}
            </span>
          )}

          {discountState.isDiscountActive && discountState.savingsAmount > 0 && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              Save ${discountState.savingsAmount.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default Product;
