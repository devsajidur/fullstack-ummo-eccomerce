import React, { useEffect, useState } from "react";
import { FaRegHeart } from "react-icons/fa6";
import { LuShare2 } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router";
import toast, { Toaster } from "react-hot-toast";
import Reviews from "./Reviews";
import AdditionalInformation from "./AdditionalInformation";
import Image from "../layout/common/Image";
import { addToCart } from "../../slices/cartSlice";
import { addWishList } from "../../slices/wishListSlice";
import { productDetail } from "../../slices/ProductDetailsSlice";
import { fetchCatalogProducts } from "../../services/api";

const SIZES = ["XS", "S", "M", "L", "XL"];
const COLORS = [
  { name: "Black", hex: "#222222" },
  { name: "Sand", hex: "#D8C3A5" },
  { name: "Navy", hex: "#1B365D" },
  { name: "Olive", hex: "#556B2F" },
];

export default function ProductDetails() {
  const detailsProduct = useSelector(
    (state) => state.clickProductDetails.Details
  );
  const [searchParams] = useSearchParams();
  const productIdParam = searchParams.get("id");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("description");
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState("Black");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (
      !detailsProduct?.id ||
      (productIdParam && String(detailsProduct.id) !== String(productIdParam))
    ) {
      fetchCatalogProducts(200)
        .then((products) => {
          if (!products?.length) return;
          const matched = productIdParam
            ? products.find((p) => String(p.id) === String(productIdParam))
            : products[0];
          if (matched) {
            dispatch(productDetail(matched));
          }
        })
        .catch(() => {});
    }
  }, [detailsProduct?.id, productIdParam, dispatch]);

  function handleAddToCart(redirectToCheckout = false) {
    if (!detailsProduct?.id) return;
    dispatch(
      addToCart({
        id: detailsProduct.id,
        title: detailsProduct.title,
        price: detailsProduct.price,
        image: detailsProduct.thumbnail,
        quantity,
        size: selectedSize,
        color: selectedColor,
      })
    );
    toast.success(
      `Added ${quantity} × ${detailsProduct.title} (${selectedSize}, ${selectedColor}) to cart!`
    );
    if (redirectToCheckout) {
      navigate("/billing");
    }
  }

  function handleWishList() {
    if (!detailsProduct?.id) return;
    dispatch(addWishList(detailsProduct));
    toast.success("Added to your wishlist!");
  }

  function handleShare() {
    navigator.clipboard?.writeText(window.location.href);
    toast.success("Product link copied to clipboard!");
  }

  if (!detailsProduct?.id) {
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
        {/* Main content: gallery + info */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-25">
          <div className="flex flex-col-reverse gap-4 sm:flex-row">
            <Image
              className="aspect-square w-full overflow-hidden bg-[#EDECE9] object-contain"
              src={detailsProduct.thumbnail}
              alt={detailsProduct.title}
            />
          </div>
          {/* Product info */}
          <div>
            <div className="mb-6 flex items-center justify-between text-sm font-medium leading-6 text-primary">
              <div>
                <span className="cursor-pointer" onClick={() => navigate("/")}>
                  HOME
                </span>
                <span className="mx-1.5">/</span>
                <span
                  className="cursor-pointer"
                  onClick={() => navigate("/shop")}
                >
                  THE SHOP
                </span>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded ${
                  Number(detailsProduct.stock ?? 20) > 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {Number(detailsProduct.stock ?? 20) > 0
                  ? `In Stock (${detailsProduct.stock ?? 20} available)`
                  : "Out of Stock"}
              </span>
            </div>

            <div className="flex flex-col">
              <h1 className="text-2xl font-normal sm:text-[26px] text-primary">
                {detailsProduct.title}
              </h1>

              <p className="mt-2 text-lg sm:text-[22px] font-medium text-primary">
                ${detailsProduct.price}
              </p>

              <p className="mt-5 text-sm leading-6 font-normal text-primary">
                {detailsProduct.description}
              </p>

              {/* Size Selector */}
              <div className="mt-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray block mb-2">
                  Size: <strong className="text-primary">{selectedSize}</strong>
                </span>
                <div className="flex gap-2">
                  {SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`w-10 h-10 text-xs font-medium border cursor-pointer transition-colors ${
                        selectedSize === sz
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 text-primary hover:border-primary"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div className="mt-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray block mb-2">
                  Color:{" "}
                  <strong className="text-primary">{selectedColor}</strong>
                </span>
                <div className="flex items-center gap-3">
                  {COLORS.map((col) => (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => setSelectedColor(col.name)}
                      style={{ backgroundColor: col.hex }}
                      title={col.name}
                      className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                        selectedColor === col.name
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Quantity + Add to Cart + Buy Now */}
              <div className="mt-7 flex flex-wrap items-center gap-4">
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
                    onClick={() => setQuantity((q) => q + 1)}
                    className="text-lg font-medium cursor-pointer px-1"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddToCart(false)}
                  className="cursor-pointer bg-primary px-8 h-12 text-sm uppercase tracking-wider font-medium text-white transition-opacity hover:opacity-90"
                >
                  Add to Cart
                </button>

                <button
                  type="button"
                  onClick={() => handleAddToCart(true)}
                  className="cursor-pointer border-2 border-primary px-6 h-12 text-sm uppercase tracking-wider font-medium text-primary hover:bg-primary hover:text-white transition-colors"
                >
                  Buy Now
                </button>
              </div>

              <div className="mt-6 flex items-center gap-6 font-medium leading-6 text-[13px] text-primary">
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

              <div className="mt-8 space-y-2 border-t border-gray/15 pt-6 text-xs text-gray">
                <p>
                  SKU:{" "}
                  <span className="text-primary">
                    {detailsProduct.sku || `UMMO-${detailsProduct.id}`}
                  </span>
                </p>
                <p>
                  CATEGORIES:{" "}
                  <span className="text-primary">{detailsProduct.category}</span>
                </p>

                <ul className="flex gap-2">
                  TAGS:{" "}
                  {detailsProduct.tags?.map((item, id) => (
                    <li key={id} className="text-primary">
                      {item},
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-14 border-b border-gray/15 sm:mt-20">
          <div className="flex flex-wrap justify-center gap-8 text-center text-xs tracking-wide sm:gap-12">
            {[
              { id: "description", label: "DESCRIPTION" },
              { id: "additional", label: "ADDITIONAL INFORMATION" },
              {
                id: "reviews",
                label: `REVIEWS (${detailsProduct.reviews?.length || 0})`,
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

        {/* Tab content */}
        {activeTab === "description" && (
          <div className="mx-auto mt-10 max-w-3xl sm:mt-14">
            <h2 className="text-base font-medium">Product Overview</h2>

            <p className="mt-4 text-sm leading-relaxed text-gray">
              {detailsProduct.description}
            </p>

            <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium">Why choose this product?</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray">
                  {[
                    "Premium quality materials and craftsmanship",
                    "Configurable attributes and verified stock availability",
                    "Backed by official brand warranty and return policy",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium">Shipping & Returns</h3>
                <ol className="mt-4 space-y-2 text-sm text-gray">
                  {[
                    detailsProduct.shippingInformation ||
                      "Fast nationwide and international delivery",
                    detailsProduct.returnPolicy ||
                      "30-day hassle-free return policy",
                    detailsProduct.availabilityStatus ||
                      "In Stock & Ready to Dispatch",
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0">{i + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeTab === "additional" && (
          <div className="mx-auto mt-10 max-w-3xl text-gray sm:mt-14">
            <AdditionalInformation />
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="mx-auto mt-10 max-w-3xl text-sm text-gray sm:mt-14">
            <Reviews />
          </div>
        )}
      </div>
    </div>
  );
}
