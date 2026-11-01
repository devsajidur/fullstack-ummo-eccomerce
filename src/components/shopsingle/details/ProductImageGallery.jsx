import React from "react";
import Image from "../../layout/common/Image";

export default function ProductImageGallery({
  galleryImages,
  activeImage,
  activeImageIdx,
  setActiveImageIdx,
  productTitle,
  discountState,
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {galleryImages.length > 1 && (
        <div className="flex sm:flex-col gap-2.5 overflow-x-auto sm:overflow-visible no-scrollbar">
          {galleryImages.slice(0, 5).map((imgUrl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveImageIdx(idx)}
              className={`w-16 h-16 sm:w-20 sm:h-20 border-2 rounded-sm bg-[#EDECE9] p-1 shrink-0 cursor-pointer transition-all ${
                activeImageIdx === idx
                  ? "border-primary"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={imgUrl}
                alt={`${productTitle} view ${idx + 1}`}
                className="w-full h-full object-contain"
                width={80}
                height={80}
                loading="lazy"
                fetchPriority="low"
              />
            </button>
          ))}
        </div>
      )}
      <div className="relative flex-1 bg-[#EDECE9] rounded-sm overflow-hidden">
        <Image
          className="aspect-square w-full object-contain"
          src={activeImage}
          alt={productTitle}
          loading="eager"
          fetchPriority="high"
          width={420}
          height={420}
        />
        {discountState.isDiscountActive && (
          <span className="absolute top-3 left-3 bg-[#D6001C] text-white text-xs font-bold px-3 py-1 rounded-sm shadow">
            -{discountState.discountPercent}% OFF
          </span>
        )}
      </div>
    </div>
  );
}
