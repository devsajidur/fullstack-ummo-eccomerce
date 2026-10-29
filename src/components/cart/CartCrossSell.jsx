import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { Plus, Sparkles, Clock, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import Image from "../layout/common/Image";
import { addToCart } from "../../slices/cartSlice";
import { productDetail } from "../../slices/ProductDetailsSlice";
import {
  getProductDiscountState,
  pad2,
  useNowTick,
} from "../../utils/discountTimer";
import { getRecentlyViewedProducts } from "../../utils/cartPromotions";

const EMPTY_ARRAY = [];

export default function CartCrossSell() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cartItems = useSelector((state) => state.cart.products) || EMPTY_ARRAY;
  const allProducts =
    useSelector((state) => state.AllProduct.Products) || EMPTY_ARRAY;
  const [activeTab, setActiveTab] = useState("recommended");
  const now = useNowTick(true);

  const recentlyViewed = useMemo(() => {
    const cartIds = new Set(cartItems.map((i) => String(i.id)));
    return getRecentlyViewedProducts().filter(
      (p) => !cartIds.has(String(p.id))
    );
  }, [cartItems]);

  const recommendedProducts = useMemo(() => {
    const cartIds = new Set(cartItems.map((i) => String(i.id)));
    const cartCategories = new Set(
      cartItems
        .map((i) => {
          const matched = allProducts.find(
            (p) => String(p.id) === String(i.id)
          );
          return matched?.category || i.category;
        })
        .filter(Boolean)
    );

    const candidates = allProducts.filter(
      (p) => !cartIds.has(String(p.id)) && Number(p.stock ?? 20) > 0
    );

    // Prioritize items from the same or complementary categories, then highest rating
    const scored = candidates.map((p) => {
      let score = Number(p.rating || 4.5);
      if (cartCategories.has(p.category)) score += 10;
      if (Number(p.discountPercentage || 0) >= 10) score += 3;
      return { product: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 4).map((s) => s.product);
  }, [cartItems, allProducts]);

  const displayList =
    activeTab === "recent" && recentlyViewed.length > 0
      ? recentlyViewed.slice(0, 4)
      : recommendedProducts;

  if (displayList.length === 0) return null;

  function handleQuickAdd(item) {
    const dState = getProductDiscountState(item, now);
    dispatch(
      addToCart({
        id: item.id,
        title: item.title,
        price: dState.effectivePrice,
        originalPrice: dState.originalPrice,
        discountPercent: dState.discountPercent,
        image: item.thumbnail,
        quantity: 1,
        size: "M",
        color: "Black",
      })
    );
    toast.success(`Added "${item.title}" to your cart!`);
  }

  function handleBundleAll() {
    displayList.forEach((item) => {
      const dState = getProductDiscountState(item, now);
      dispatch(
        addToCart({
          id: item.id,
          title: item.title,
          price: dState.effectivePrice,
          originalPrice: dState.originalPrice,
          discountPercent: dState.discountPercent,
          image: item.thumbnail,
          quantity: 1,
          size: "M",
          color: "Black",
        })
      );
    });
    toast.success(
      `Added all ${displayList.length} recommended items to your cart!`
    );
  }

  function handleOpenProduct(item) {
    dispatch(productDetail(item));
    navigate(`/shopsingle?id=${item.id}`);
  }

  return (
    <div className="mt-14 pt-10 border-t border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#D6001C]">
            <Sparkles size={13} /> Smart Cart Recommendations
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-primary uppercase mt-0.5">
            Customers Who Bought Your Items Also Bought
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Add 1 more item to unlock{" "}
            <strong className="text-gray-800">Buy 2 Get 1 FREE</strong> or reach
            your <strong className="text-gray-800">Free Express Delivery</strong>{" "}
            goal faster!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("recommended")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === "recommended"
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Frequently Bought Together
          </button>
          {recentlyViewed.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("recent")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === "recent"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Clock size={13} /> Recently Viewed ({recentlyViewed.length})
            </button>
          )}
          <button
            type="button"
            onClick={handleBundleAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors"
          >
            <ShoppingBag size={13} /> Bundle All ({displayList.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {displayList.map((item) => {
          const dState = getProductDiscountState(item, now);
          return (
            <div
              key={item.id}
              className="border border-gray-200 rounded-xl p-3.5 bg-white hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div
                  onClick={() => handleOpenProduct(item)}
                  className="relative bg-[#f8f8f8] rounded-lg p-3 cursor-pointer overflow-hidden"
                >
                  <Image
                    product={item}
                    src={item.thumbnail || item.image}
                    alt={item.title}
                    width={180}
                    height={144}
                    className="h-32 sm:h-36 w-full object-contain mx-auto transition-transform duration-300 hover:scale-105"
                  />
                  {dState.isDiscountActive && (
                    <span className="absolute top-2 left-2 bg-[#D6001C] text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">
                      -{dState.discountPercent}% OFF
                    </span>
                  )}
                  {dState.hasActiveTimer && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/75 text-white text-[10px] font-mono font-semibold py-0.5 text-center">
                      ⚡ {dState.days > 0 ? `${dState.days}d ` : ""}
                      {pad2(dState.hours)}h:{pad2(dState.minutes)}m:
                      {pad2(dState.seconds)}s
                    </div>
                  )}
                </div>

                <p className="text-[10px] uppercase text-gray-400 font-semibold mt-2.5 truncate">
                  {item.category}
                </p>
                <h4
                  onClick={() => handleOpenProduct(item)}
                  className="text-xs sm:text-sm font-semibold text-primary hover:underline cursor-pointer line-clamp-1 mt-0.5"
                >
                  {item.title}
                </h4>

                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm font-bold text-[#D6001C]">
                    ${dState.effectivePrice.toFixed(2)}
                  </span>
                  {dState.isDiscountActive && (
                    <span className="text-xs text-gray-400 line-through">
                      ${dState.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleQuickAdd(item)}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold uppercase tracking-wider py-2.5 rounded-lg cursor-pointer transition-colors"
              >
                <Plus size={14} /> Add to Order
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
