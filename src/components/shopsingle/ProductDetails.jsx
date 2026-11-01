import React, { useEffect, useMemo, useState } from "react";
import { FaRegHeart } from "react-icons/fa6";
import { LuShare2 } from "react-icons/lu";
import { Gift, RotateCcw, ShieldCheck, Truck, Zap } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router";
import toast, { Toaster } from "react-hot-toast";
import Reviews from "./Reviews";
import AdditionalInformation from "./AdditionalInformation";
import ProductImageGallery from "./details/ProductImageGallery";
import ProductVariantPicker from "./details/ProductVariantPicker";
import SizeGuideModal from "./details/SizeGuideModal";
import {
  addToCart,
  sanitizeClientProductMessage,
} from "../../slices/cartSlice";
import { addWishList } from "../../slices/wishListSlice";
import { productDetail } from "../../slices/ProductDetailsSlice";
import {
  fetchCatalogProducts,
  getInitialCatalogSnapshot,
} from "../../services/api";
import {
  getProductDiscountState,
  pad2,
  useNowTick,
} from "../../utils/discountTimer";
import {
  getProductFreeGiftConfig,
  recordRecentlyViewedProduct,
} from "../../utils/cartPromotions";
import { classifyProductTaxonomy } from "../../utils/categoryTaxonomy";
import { resolveProductVariants } from "../../utils/productVariants";
import { buildProductSeoConfig, usePageSeo } from "../../utils/seo";

export default function ProductDetails() {
  const detailsProduct = useSelector(
    (state) => state.clickProductDetails.Details
  );
  const catalogProducts = useSelector((state) => state.AllProduct.Products);
  const { id: routeParamId } = useParams();
  const [searchParams] = useSearchParams();
  const productIdParam = searchParams.get("id") || routeParamId;
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const targetId = productIdParam || detailsProduct?.id || 1;
  const fallbackCatalog =
    catalogProducts && catalogProducts.length > 0
      ? catalogProducts
      : getInitialCatalogSnapshot();
  const liveProduct =
    fallbackCatalog.find((p) => String(p.id) === String(targetId)) ||
    detailsProduct ||
    fallbackCatalog[0];

  const variantInfo = useMemo(
    () => resolveProductVariants(liveProduct),
    [liveProduct]
  );

  const [activeTab, setActiveTab] = useState("description");
  const [selectedSize, setSelectedSize] = useState(
    () => variantInfo.sizes[0] || ""
  );
  const [selectedColor, setSelectedColor] = useState(
    () => variantInfo.colors[0]?.name || ""
  );
  const [quantity, setQuantity] = useState(1);
  const [optionalMessage, setOptionalMessage] = useState("");
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  const freeGiftConfig = getProductFreeGiftConfig(liveProduct, catalogProducts);

  const sizesKey = variantInfo.sizes.join("|");
  const colorsKey = variantInfo.colors.map((c) => c.name).join("|");

  useEffect(() => {
    setSelectedSize((prev) =>
      variantInfo.sizes.includes(prev) ? prev : variantInfo.sizes[0] || ""
    );
  }, [liveProduct?.id, sizesKey, variantInfo.sizes]);

  useEffect(() => {
    setSelectedColor((prev) =>
      variantInfo.colors.some((c) => c.name === prev)
        ? prev
        : variantInfo.colors[0]?.name || ""
    );
  }, [liveProduct?.id, colorsKey, variantInfo.colors]);

  useEffect(() => {
    if (liveProduct?.id) {
      recordRecentlyViewedProduct(liveProduct);
    }
  }, [liveProduct?.id, liveProduct]);

  useEffect(() => {
    setActiveImageIdx(0);
    setQuantity(1);
    setOptionalMessage("");
  }, [targetId]);

  useEffect(() => {
    const needsRemoteLookup =
      productIdParam && String(liveProduct?.id) !== String(productIdParam);
    const delayMs = needsRemoteLookup ? 0 : 2500;
    const timer = setTimeout(() => {
      fetchCatalogProducts(200).then((products) => {
        if (!products?.length) return;
        const matched = productIdParam
          ? products.find((p) => String(p.id) === String(productIdParam))
          : products[0];
        if (
          matched &&
          (!detailsProduct?.id ||
            String(detailsProduct.id) !== String(matched.id)) &&
          String(liveProduct?.id) !== String(matched.id)
        ) {
          dispatch(productDetail(matched));
        }
      });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [detailsProduct?.id, liveProduct?.id, productIdParam, dispatch]);

  const hasTimer = Boolean(
    liveProduct?.discountEndTime && liveProduct.discountEndTime !== "none"
  );
  const now = useNowTick(hasTimer);
  const discountState = getProductDiscountState(liveProduct, now);
  const stockCount = Number(liveProduct?.stock ?? 20);
  const taxonomy = useMemo(
    () => classifyProductTaxonomy(liveProduct),
    [liveProduct]
  );

  usePageSeo(buildProductSeoConfig(liveProduct, discountState, taxonomy));

  const galleryImages =
    Array.isArray(liveProduct?.images) && liveProduct.images.length > 0
      ? liveProduct.images
      : [liveProduct?.thumbnail].filter(Boolean);
  const activeImage =
    galleryImages[activeImageIdx] || liveProduct?.thumbnail || "";

  function handleAddToCart(redirectToCheckout = false, customQty = null) {
    if (!liveProduct?.id) return;
    if (stockCount <= 0) {
      toast.error("Sorry, this product is currently out of stock.");
      return;
    }
    const finalQty = Math.max(
      1,
      Number(customQty !== null ? customQty : quantity) || 1
    );
    const latestDiscount = getProductDiscountState(liveProduct);
    const cleanedMessage = sanitizeClientProductMessage(optionalMessage).trim();
    const chosenSize = variantInfo.sizes.length > 0 ? selectedSize : "";
    const chosenColor = variantInfo.colors.length > 0 ? selectedColor : "";

    dispatch(
      addToCart({
        id: liveProduct.id,
        productId: liveProduct.id,
        title: liveProduct.title,
        productNameSnapshot: liveProduct.title,
        price: latestDiscount.effectivePrice,
        unitPriceSnapshot: latestDiscount.effectivePrice,
        originalPrice: latestDiscount.originalPrice,
        discountPercent: latestDiscount.discountPercent,
        discountPercentage: liveProduct.discountPercentage,
        discountEndTime: liveProduct.discountEndTime || null,
        freeGift: liveProduct.freeGift || null,
        image: liveProduct.thumbnail,
        thumbnail: liveProduct.thumbnail,
        productImageSnapshot: liveProduct.thumbnail,
        quantity: finalQty,
        size: chosenSize,
        color: chosenColor,
        optionalMessage: cleanedMessage,
      })
    );
    setOptionalMessage("");
    const variantSuffix = [chosenSize, chosenColor].filter(Boolean).join(" / ");
    if (freeGiftConfig && finalQty >= freeGiftConfig.minBuyQty) {
      const earnedGifts =
        Math.floor(finalQty / freeGiftConfig.minBuyQty) *
        freeGiftConfig.giftQty;
      toast.success(
        `Added ${finalQty} × ${liveProduct.title}${variantSuffix ? ` (${variantSuffix})` : ""} + 🎁 ${earnedGifts}x FREE "${freeGiftConfig.giftName}" to cart!`
      );
    } else {
      toast.success(
        `Added ${finalQty} × ${liveProduct.title}${variantSuffix ? ` (${variantSuffix})` : ""} ($${(latestDiscount.effectivePrice * finalQty).toFixed(2)}) to cart!`
      );
    }
    if (redirectToCheckout) {
      navigate("/billing");
    }
  }

  function handleWishList() {
    if (!liveProduct?.id) return;
    dispatch(addWishList(liveProduct));
    toast.success("Added to your wishlist!");
  }

  function handleShare() {
    navigator.clipboard?.writeText(window.location.href);
    toast.success("Product link copied to clipboard!");
  }

  if (!liveProduct?.id) {
    return (
      <div className="min-h-96 flex items-center justify-center font-jost text-gray">
        Loading product details...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-jost text-primary px-3">
      <Toaster position="top-center" />
      <div className="mx-auto container px-4 py-8 sm:px-4 md:px-0 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-20">
          <ProductImageGallery
            galleryImages={galleryImages}
            activeImage={activeImage}
            activeImageIdx={activeImageIdx}
            setActiveImageIdx={setActiveImageIdx}
            productTitle={liveProduct.title}
            discountState={discountState}
          />

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-medium leading-6 text-primary">
              <div className="flex flex-wrap items-center gap-1">
                <span
                  className="cursor-pointer hover:underline"
                  onClick={() => navigate("/")}
                >
                  HOME
                </span>
                <span className="mx-1">/</span>
                <span
                  className="cursor-pointer hover:underline"
                  onClick={() => navigate("/shop")}
                >
                  SHOP
                </span>
                <span className="mx-1">/</span>
                <span
                  className="cursor-pointer uppercase font-bold hover:underline"
                  onClick={() => navigate(`/category/${taxonomy.department}`)}
                >
                  {taxonomy.departmentName}
                </span>
                {taxonomy.subcategory && (
                  <>
                    <span className="mx-1">/</span>
                    <span
                      className="cursor-pointer uppercase text-gray-600 hover:underline"
                      onClick={() =>
                        navigate(
                          `/category/${taxonomy.department}?sub=${encodeURIComponent(
                            taxonomy.subcategory
                          )}`
                        )
                      }
                    >
                      {taxonomy.subcategory}
                    </span>
                  </>
                )}
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded ${
                  stockCount > 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {stockCount > 0
                  ? `In Stock (${stockCount} available)`
                  : "Out of Stock"}
              </span>
            </div>

            <div className="flex flex-col">
              <h1 className="text-xl sm:text-[26px] font-semibold text-primary leading-snug">
                {liveProduct.title}
              </h1>

              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <span
                  className={`text-xl sm:text-[26px] font-extrabold ${
                    discountState.isDiscountActive
                      ? "text-[#D6001C]"
                      : "text-primary"
                  }`}
                >
                  ${discountState.effectivePrice.toFixed(2)}
                </span>
                {discountState.isDiscountActive && (
                  <>
                    <span className="text-base sm:text-lg text-gray-600 line-through font-medium">
                      ${discountState.regularPrice.toFixed(2)}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider bg-red-50 text-[#D6001C] border border-red-200 px-2.5 py-1 rounded-full">
                      Save ${discountState.savingsAmount.toFixed(2)} (-
                      {discountState.discountPercentage}% OFF)
                    </span>
                  </>
                )}
              </div>

              {discountState.hasActiveTimer && (
                <div
                  className="mt-4 p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-[#fff5f5] to-[#fffbeb] border border-red-200"
                  data-testid="single-product-countdown"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D6001C]">
                      <Zap size={15} className="fill-[#D6001C] shrink-0" />
                      <span>Limited-Time Offer</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono flex-wrap">
                      <TimerBox value={pad2(discountState.days)} label="Days" />
                      <span className="font-bold text-[#D6001C]">:</span>
                      <TimerBox
                        value={pad2(discountState.hours)}
                        label="Hours"
                      />
                      <span className="font-bold text-[#D6001C]">:</span>
                      <TimerBox
                        value={pad2(discountState.minutes)}
                        label="Minutes"
                      />
                      <span className="font-bold text-[#D6001C]">:</span>
                      <TimerBox
                        value={pad2(discountState.seconds)}
                        label="Seconds"
                      />
                    </div>
                  </div>
                </div>
              )}

              {stockCount > 0 && stockCount <= 15 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-amber-800 mb-1">
                    Hurry! Only <strong>{stockCount}</strong> items left in
                    stock.
                  </p>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(15, (stockCount / 20) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <p className="mt-4 text-sm leading-6 font-normal text-primary">
                {liveProduct.description}
              </p>

              <ProductVariantPicker
                variantInfo={variantInfo}
                selectedSize={selectedSize}
                setSelectedSize={setSelectedSize}
                selectedColor={selectedColor}
                setSelectedColor={setSelectedColor}
                onOpenSizeGuide={() => setShowSizeGuide(true)}
              />

              <div className="mt-5 p-3.5 rounded-lg border border-gray-200 bg-gray-50/70">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="product-optional-message"
                    className="text-xs font-semibold uppercase tracking-wider text-primary"
                  >
                    Message for this product (optional)
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      optionalMessage.length >= 480
                        ? "text-[#D6001C] font-bold"
                        : "text-gray-600"
                    }`}
                  >
                    {optionalMessage.length}/500
                  </span>
                </div>
                <input
                  id="product-optional-message"
                  type="text"
                  maxLength={500}
                  value={optionalMessage}
                  onChange={(e) =>
                    setOptionalMessage(
                      sanitizeClientProductMessage(e.target.value)
                    )
                  }
                  placeholder="e.g. Please wrap this product as a gift / pack separately..."
                  className="w-full border border-gray-300 bg-white rounded px-3 py-2 text-xs text-primary outline-none focus:border-primary"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    "Please wrap this product as a gift.",
                    "Please pack this item separately.",
                    "Please check the selected color carefully.",
                    "This item is for a birthday.",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOptionalMessage(preset)}
                      className="text-[10px] bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded px-2 py-0.5 cursor-pointer transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center border-2 border-gray-300 h-12 px-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="text-lg font-medium cursor-pointer px-1"
                  >
                    -
                  </button>
                  <span className="text-sm font-semibold w-6 text-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) =>
                        Math.min(Math.max(1, stockCount), q + 1)
                      )
                    }
                    className="text-lg font-medium cursor-pointer px-1"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  disabled={stockCount <= 0}
                  onClick={() => handleAddToCart(false)}
                  className="cursor-pointer bg-primary px-8 h-12 text-sm uppercase tracking-wider font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {stockCount <= 0
                    ? "Out of Stock"
                    : quantity > 1
                      ? `Add ${quantity} to Cart ($${(discountState.effectivePrice * quantity).toFixed(2)})`
                      : "Add to Cart"}
                </button>

                <button
                  type="button"
                  disabled={stockCount <= 0}
                  onClick={() => handleAddToCart(true)}
                  className="cursor-pointer border-2 border-primary px-6 h-12 text-sm uppercase tracking-wider font-medium text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                >
                  Buy Now
                </button>
              </div>

              {freeGiftConfig && stockCount > 0 && (
                <div className="mt-4 p-3.5 rounded-lg border border-emerald-300 bg-emerald-50/70 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-emerald-950">
                    {freeGiftConfig.giftImage ? (
                      <img
                        src={freeGiftConfig.giftImage}
                        alt={freeGiftConfig.giftName}
                        className="w-11 h-11 rounded object-contain bg-white border border-emerald-200 p-0.5 shrink-0"
                      />
                    ) : (
                      <Gift size={20} className="text-emerald-700 shrink-0" />
                    )}
                    <div>
                      <p className="font-bold uppercase tracking-wide text-emerald-900">
                        🎁 Free Gift With This Product!
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Buy{" "}
                        <strong>
                          {freeGiftConfig.minBuyQty} unit
                          {freeGiftConfig.minBuyQty > 1 ? "s" : ""}
                        </strong>{" "}
                        of this product &amp; get{" "}
                        <strong>
                          {freeGiftConfig.giftQty}x {freeGiftConfig.giftName}
                        </strong>{" "}
                        for{" "}
                        <strong className="text-emerald-700">
                          $0.00 (FREE)
                        </strong>
                        !
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleAddToCart(false, freeGiftConfig.minBuyQty)
                    }
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded cursor-pointer transition-colors"
                  >
                    + Buy {freeGiftConfig.minBuyQty} &amp; Get Free Gift
                  </button>
                </div>
              )}

              <div className="mt-5 flex items-center gap-6 font-medium leading-6 text-[13px] text-primary">
                <button
                  onClick={handleWishList}
                  className="flex items-center gap-2 transition-colors hover:text-gray cursor-pointer"
                >
                  <FaRegHeart size={15} strokeWidth={1.5} />
                  ADD TO WISHLIST
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 transition-colors hover:text-gray cursor-pointer"
                >
                  <LuShare2 size={15} strokeWidth={1.5} />
                  SHARE
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-5 border-t border-gray-200 text-xs text-gray-700">
                <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded">
                  <Truck size={16} className="text-primary shrink-0" />
                  <span>Fast 2–4 Day Delivery</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded">
                  <RotateCcw size={16} className="text-primary shrink-0" />
                  <span>30-Day Easy Returns</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded">
                  <ShieldCheck size={16} className="text-primary shrink-0" />
                  <span>100% Authentic Guaranteed</span>
                </div>
              </div>

              <div className="mt-5 space-y-1.5 border-t border-gray/15 pt-4 text-xs text-gray">
                <p>
                  SKU:{" "}
                  <span className="text-primary">
                    {liveProduct.sku || `UMMO-${liveProduct.id}`}
                  </span>
                </p>
                <p>
                  CATEGORIES:{" "}
                  <span className="text-primary">{liveProduct.category}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 border-b border-gray/15 sm:mt-20">
          <div className="flex flex-wrap justify-center gap-8 text-center text-xs tracking-wide sm:gap-12">
            {[
              { id: "description", label: "DESCRIPTION" },
              { id: "additional", label: "ADDITIONAL INFORMATION" },
              {
                id: "reviews",
                label: `REVIEWS (${liveProduct.reviews?.length || 0})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-4 cursor-pointer transition-colors ${
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-gray hover:text-primary"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 h-px w-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "description" && (
          <div className="mx-auto mt-10 max-w-3xl sm:mt-14">
            <h2 className="text-base font-medium">Product Overview</h2>
            <p className="mt-4 text-sm leading-relaxed text-gray">
              {liveProduct.description}
            </p>
          </div>
        )}

        {activeTab === "additional" && (
          <div className="mx-auto mt-10 max-w-3xl text-gray sm:mt-14">
            <AdditionalInformation product={liveProduct} />
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="mx-auto mt-10 max-w-3xl text-sm text-gray sm:mt-14">
            <Reviews />
          </div>
        )}
      </div>

      {showSizeGuide && (
        <SizeGuideModal
          selectedSize={selectedSize}
          onClose={() => setShowSizeGuide(false)}
        />
      )}
    </div>
  );
}

function TimerBox({ value, label }) {
  return (
    <div className="bg-gray-900 text-white rounded px-2 py-1 text-center min-w-[42px]">
      <span className="block text-xs sm:text-sm font-bold leading-tight">
        {value}
      </span>
      <span className="block text-[9px] text-gray-300 uppercase">{label}</span>
    </div>
  );
}
