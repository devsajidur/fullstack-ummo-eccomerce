import React, { useState } from "react";
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  resolveProductImage,
} from "../../../utils/productImage";
import { getCloudinaryProductImageUrl } from "../../../services/cloudinary";

const Image = ({
  src,
  imgSrc,
  item,
  product,
  productId,
  fallbackProduct,
  catalogLookup,
  alt,
  imgAlt,
  className = "",
  width = 300,
  height = 300,
  loading = "lazy",
  decoding = "async",
  ...rest
}) => {
  const effectiveSrc = src || imgSrc;
  const effectiveAlt = alt || imgAlt || "UOMO Product";
  const sourceEntity =
    item ||
    product ||
    (productId ? { id: productId, image: effectiveSrc } : effectiveSrc);
  const resolvedPrimary = resolveProductImage(
    sourceEntity,
    fallbackProduct || [],
    catalogLookup || { width }
  );
  const [failedSrc, setFailedSrc] = useState(null);
  const [triedCatalogFallback, setTriedCatalogFallback] = useState(false);

  const effectiveId =
    productId ?? item?.id ?? item?.productId ?? product?.id ?? "";
  const numericId = Number(effectiveId);

  let finalSrc = resolvedPrimary;
  if (failedSrc === resolvedPrimary) {
    const fallbackResolved = fallbackProduct
      ? resolveProductImage(fallbackProduct, null, catalogLookup)
      : "";
    if (
      !triedCatalogFallback &&
      fallbackResolved &&
      fallbackResolved !== resolvedPrimary &&
      fallbackResolved !== PRODUCT_IMAGE_PLACEHOLDER
    ) {
      finalSrc = fallbackResolved;
    } else if (
      !triedCatalogFallback &&
      Number.isInteger(numericId) &&
      numericId >= 1 &&
      numericId <= 194
    ) {
      const catalogUrl = getCloudinaryProductImageUrl(numericId);
      finalSrc =
        catalogUrl && catalogUrl !== resolvedPrimary
          ? catalogUrl
          : PRODUCT_IMAGE_PLACEHOLDER;
    } else {
      finalSrc = PRODUCT_IMAGE_PLACEHOLDER;
    }
  }

  return (
    <img
      className={className}
      src={finalSrc || PRODUCT_IMAGE_PLACEHOLDER}
      alt={effectiveAlt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      onError={() => {
        if (failedSrc !== resolvedPrimary) {
          setFailedSrc(resolvedPrimary);
        } else if (!triedCatalogFallback) {
          setTriedCatalogFallback(true);
        }
      }}
      {...rest}
    />
  );
};

export default Image;
