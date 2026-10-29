import React, { memo } from "react";
import Image from "./Image";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../../slices/cartSlice";
import {
  addWishList,
  deleteWishEndevisual,
} from "../../../slices/wishListSlice";
import { productDetail } from "../../../slices/ProductDetailsSlice";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  getProductDiscountState,
  pad2,
  useNowTick,
} from "../../../utils/discountTimer";

/**
 * Isolated countdown pill so 1-second timer ticks only update this tiny text span
 * and never re-render the parent Product card or image.
 */
const ProductCountdownPill = memo(function ProductCountdownPill({ item }) {
  const now = useNowTick(true);
  const discountState = getProductDiscountState(item, now);
  if (!discountState.hasActiveTimer) return null;

  return (
    <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-[2px] text-white px-2 py-1 flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-mono font-semibold tracking-tight">
      <span className="text-amber-400">⚡</span>
      <span>
        {discountState.days > 0 ? `${discountState.days}d ` : ""}
        {pad2(discountState.hours)}h : {pad2(discountState.minutes)}m :{" "}
        {pad2(discountState.seconds)}s
      </span>
    </div>
  );
});

const Product = memo(function Product({ item }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isWished = useSelector((state) =>
    (state.wishList.wishProduct || []).some(
      (w) => String(w.id) === String(item?.id)
    )
  );

  const hasTimer = Boolean(
    item?.discountEndTime && item.discountEndTime !== "none"
  );
  const discountState = getProductDiscountState(item);
  const stockCount = Number(item?.stock ?? 20);

  const hasFreeGift =
    Boolean(item?.freeGift?.enabled) &&
    Boolean(String(item?.freeGift?.giftName || "").trim());

  function handleAddtoCart(Citem) {
    if (stockCount <= 0) {
      toast.error("Sorry, this product is currently out of stock.");
      return;
    }
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
    if (hasFreeGift) {
      toast.success(
        `"${Citem.title}" added! Free Gift: ${item.freeGift.giftQty || 1}x ${item.freeGift.giftName}`
      );
    } else {
      toast.success(
        `"${Citem.title}" added to cart at $${latestDiscount.effectivePrice.toFixed(2)}!`
      );
    }
  }

  const handleToggleWish = () => {
    if (isWished) {
      dispatch(deleteWishEndevisual(item));
      toast("Removed from wishlist", { icon: "🗑️" });
    } else {
      dispatch(addWishList(item));
      toast.success("Saved to wishlist ❤️");
    }
  };

  const handleProductDetails = (dtail) => {
    dispatch(productDetail(dtail));
    navigate(`/shopsingle?id=${dtail.id}`);
  };

  return (
    <div className="max-w-82.5 group relative">
      <div
        onClick={() => handleProductDetails(item)}
        className="cursor-pointer relative overflow-hidden bg-[#f8f8f8] rounded-sm"
      >
        <Image
          className="md:h-80 md:w-50 h-40 w-30 block mx-auto object-contain transition-transform duration-300 group-hover:scale-105"
          src={item?.thumbnail}
          alt={item?.title}
          width={200}
          height={320}
        />

        {/* Top-Left Discount & Free Gift Badges */}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {discountState.isDiscountActive && (
            <span className="bg-[#D6001C] text-white text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-xs">
              -{discountState.discountPercent}% OFF
            </span>
          )}
          {hasFreeGift && (
            <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-xs">
              🎁 Free: {item.freeGift.giftQty || 1}x {item.freeGift.giftName}
            </span>
          )}
        </div>

        {/* Top-Right Stock Scarcity Badge */}
        {stockCount <= 0 ? (
          <span className="absolute top-2 right-2 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">
            SOLD OUT
          </span>
        ) : (
          stockCount < 10 && (
            <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">
              Only {stockCount} left
            </span>
          )
        )}

        {/* Live Countdown Timer Bar on Product Card */}
        {hasTimer && <ProductCountdownPill item={item} />}
      </div>

      <div className="mt-3.2">
        <div className="flex justify-between items-center h-5">
          <h4 className="text-[12px] md:text-sm text-gray font-normal uppercase truncate pr-2">
            {item?.category}
          </h4>
          <button
            type="button"
            aria-label="Toggle Wishlist"
            className="cursor-pointer shrink-0"
            onClick={handleToggleWish}
          >
            {isWished ? (
              <span className="text-[15px]">❤️</span>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_31_61)">
                  <path
                    d="M14.7145 2.64647C12.9744 0.906815 10.1436 0.906815 8.40393 2.64647L7.99986 3.0503L7.59603 2.64647C5.85637 0.906579 3.02531 0.906579 1.28565 2.64647C-0.418689 4.35081 -0.429756 7.05236 1.25998 8.93071C2.80114 10.6433 7.34643 14.3432 7.53928 14.4998C7.6702 14.6063 7.82773 14.6581 7.98432 14.6581C7.9895 14.6581 7.99468 14.6581 7.99963 14.6578C8.16163 14.6654 8.32481 14.6098 8.45997 14.4998C8.65282 14.3432 13.1986 10.6433 14.7402 8.93048C16.4297 7.05236 16.4186 4.35081 14.7145 2.64647ZM13.69 7.98554C12.4884 9.32042 9.18546 12.0735 7.99963 13.0505C6.8138 12.0738 3.51155 9.32089 2.31018 7.98577C1.13142 6.67561 1.12035 4.80974 2.28452 3.64557C2.87908 3.05125 3.6599 2.75385 4.44072 2.75385C5.22154 2.75385 6.00236 3.05101 6.59693 3.64557L7.48512 4.53377C7.59085 4.6395 7.72412 4.7026 7.86399 4.72474C8.09099 4.77348 8.33729 4.71014 8.51389 4.53401L9.40256 3.64557C10.5919 2.45668 12.5266 2.45692 13.7152 3.64557C14.8794 4.80974 14.8683 6.67561 13.69 7.98554Z"
                    fill="#767676"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_31_61">
                    <rect width="16" height="16" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            )}
          </button>
        </div>
        <h3
          onClick={() => handleProductDetails(item)}
          className="cursor-pointer clamp font-medium text-sm text-primary hover:underline"
        >
          {item?.title}
        </h3>
        <div className="flex items-center justify-between mt-0.5">
          <div className="flex items-center gap-2">
            <h5
              className={`md:text-base text-[14px] font-semibold uppercase ${
                discountState.isDiscountActive
                  ? "text-[#D6001C]"
                  : "text-primary"
              }`}
            >
              ${discountState.effectivePrice.toFixed(2)}
            </h5>
            {discountState.isDiscountActive && (
              <span className="text-xs text-gray-400 line-through">
                ${discountState.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
          {item?.rating && (
            <span className="text-[11px] text-amber-600 font-medium">
              ★ {Number(item.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => handleAddtoCart(item)}
          className="absolute md:invisible md:group-hover:visible cursor-pointer bottom-22 md:bottom-28 left-[50%] translate-[-50%] w-[90%] md:w-77.5 shadow-xl shadow-[#3333335b] font-medium text-[12px] md:text-sm bg-white hover:bg-black hover:text-white transition-colors text-black h-7 md:h-12.5 text-center z-10"
        >
          {stockCount <= 0 ? "OUT OF STOCK" : "ADD TO CART"}
        </button>
      </div>
    </div>
  );
});

export default Product;
