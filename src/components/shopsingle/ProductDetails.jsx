import React, { useEffect, useState } from "react";
import { FaRegHeart } from "react-icons/fa6";
import { LuShare2 } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router";
import Reviews from "./Reviews";
import AdditionalInformation from "./AdditionalInformation";
import Image from "../layout/common/Image";
import { addToCart } from "../../slices/cartSlice";
import { addWishList } from "../../slices/wishListSlice";
import { productDetail } from "../../slices/ProductDetailsSlice";
import { fetchCatalogProducts } from "../../services/api";

export default function ProductDetails() {
  const detailsProduct = useSelector(
    (state) => state.clickProductDetails.Details
  );
  const [searchParams] = useSearchParams();
  const productIdParam = searchParams.get("id");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("description");

  useEffect(() => {
    if (!detailsProduct?.id || (productIdParam && String(detailsProduct.id) !== String(productIdParam))) {
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

  function handleAddToCart() {
    if (!detailsProduct?.id) return;
    dispatch(
      addToCart({
        id: detailsProduct.id,
        title: detailsProduct.title,
        price: detailsProduct.price,
        image: detailsProduct.thumbnail,
      })
    );
  }

  function handleWishList() {
    if (!detailsProduct?.id) return;
    dispatch(addWishList(detailsProduct));
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
      <div className="mx-auto container px-4 py-8 sm:px-4 md:px-0 lg:py-12">
        {/* Main content: gallery + info */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-25">
          <div className="flex flex-col-reverse gap-4 sm:flex-row">
            <Image
              className="aspect-square w-full overflow-hidden bg-[#EDECE9]"
              src={detailsProduct.thumbnail}
              alt={detailsProduct.title}
            />
          </div>
          {/* Product info */}
          <div>
            <div className="mb-8 flex items-center justify-between text-sm font-medium leading-6 text-primary sm:mb-10">
              <div>
                <span className="cursor-pointer" onClick={() => navigate("/")}>
                  HOME
                </span>
                <span className="ml-1">/</span>{" "}
                <span
                  className="cursor-pointer"
                  onClick={() => navigate("/shop")}
                >
                  THE SHOP
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <h1 className="text-2xl font-normal sm:text-[26px] text-primary">
                {detailsProduct.title}
              </h1>

              <p className="mt-2 text-lg sm:text-[22px] font-medium text-primary">
                ${detailsProduct.price}
              </p>

              <p className="mt-6.25 text-sm leading-6 font-normal text-primary">
                {detailsProduct.description}
              </p>

              <button
                onClick={handleAddToCart}
                className="mt-7 w-fit cursor-pointer bg-primary px-8 py-3 text-lg font-normal text-white transition-opacity hover:opacity-90"
              >
                Add to Cart
              </button>

              <div className="mt-6 flex items-center gap-6 font-medium leading-6 text-[13px] text-primary">
                <button
                  onClick={handleWishList}
                  className="flex items-center gap-2 transition-colors hover:text-gray cursor-pointer"
                >
                  <FaRegHeart size={15} strokeWidth={1.5} />
                  ADD TO WISHLIST
                </button>
                <button className="flex items-center gap-2 transition-colors hover:text-gray cursor-pointer">
                  <LuShare2 size={15} strokeWidth={1.5} />
                  SHARE
                </button>
              </div>

              <div className="mt-8 space-y-2 border-t border-gray/15 pt-6 text-xs text-gray">
                <p>
                  SKU: <span className="text-primary">{detailsProduct.sku || "N/A"}</span>
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
                    detailsProduct.shippingInformation || "Fast nationwide and international delivery",
                    detailsProduct.returnPolicy || "30-day hassle-free return policy",
                    detailsProduct.availabilityStatus || "In Stock & Ready to Dispatch",
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
