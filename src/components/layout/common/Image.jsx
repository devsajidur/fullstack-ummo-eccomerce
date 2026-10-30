import React, { useEffect, useRef, useState } from "react";
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  resolveProductImage,
} from "../../../utils/productImage";
import { getCloudinaryProductImageUrl } from "../../../services/cloudinary";

const observerCallbacks = new WeakMap();
let sharedObserver = null;

function getSharedIntersectionObserver() {
  if (sharedObserver || typeof IntersectionObserver === "undefined") {
    return sharedObserver;
  }
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          const cb = observerCallbacks.get(entry.target);
          if (cb) {
            cb();
            observerCallbacks.delete(entry.target);
          }
          sharedObserver.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "80px 0px" }
  );
  return sharedObserver;
}

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
  const isEager =
    loading === "eager" ||
    rest.fetchPriority === "high" ||
    rest.fetchpriority === "high";
  const [inView, setInView] = useState(
    () => isEager || typeof IntersectionObserver === "undefined"
  );
  const imgRef = useRef(null);

  useEffect(() => {
    if (isEager || inView) return undefined;
    const node = imgRef.current;
    let observed = false;
    const timer = setTimeout(() => {
      const obs = getSharedIntersectionObserver();
      if (!node || !obs) {
        setInView(true);
        return;
      }
      observerCallbacks.set(node, () => setInView(true));
      obs.observe(node);
      observed = true;
    }, 220);
    return () => {
      clearTimeout(timer);
      if (node && observed && sharedObserver) {
        observerCallbacks.delete(node);
        sharedObserver.unobserve(node);
      }
    };
  }, [isEager, inView]);

  const effectiveFetchPriority =
    rest.fetchPriority ||
    rest.fetchpriority ||
    (isEager ? "high" : loading === "lazy" ? "low" : undefined);

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

  const activeSrc =
    isEager || inView ? finalSrc || PRODUCT_IMAGE_PLACEHOLDER : PRODUCT_IMAGE_PLACEHOLDER;

  return (
    <img
      ref={imgRef}
      className={className}
      src={activeSrc}
      data-cloudinary-src={finalSrc || ""}
      alt={effectiveAlt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      fetchPriority={effectiveFetchPriority}
      onError={() => {
        if (!isEager && !inView) return;
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
