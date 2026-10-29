import {
  CLOUDINARY_CLOUD_NAME,
  getCloudinaryProductImageUrl,
} from "../services/cloudinary.js";

/**
 * Premium neutral SVG placeholder displayed only when a product genuinely has no valid image.
 */
export const PRODUCT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#F5F5F5"/>
      <rect x="140" y="125" width="120" height="100" rx="8" fill="none" stroke="#9CA3AF" stroke-width="6"/>
      <circle cx="172" cy="157" r="10" fill="#9CA3AF"/>
      <path d="M148 210 L185 175 L212 200 L232 182 L252 210 Z" fill="#9CA3AF"/>
      <text x="200" y="262" text-anchor="middle" font-family="Jost, system-ui, sans-serif" font-size="15" font-weight="600" fill="#4B5563" letter-spacing="1.5">UOMO</text>
      <text x="200" y="284" text-anchor="middle" font-family="Jost, system-ui, sans-serif" font-size="12" fill="#9CA3AF">Image unavailable</text>
    </svg>`
  );

function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return false;
  if (/^(javascript|vbscript|data:text\/html):/i.test(trimmed)) return false;
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  );
}

/**
 * Optimizes a Cloudinary URL with responsive width & format parameters while preserving path integrity.
 */
export function optimizeImageUrl(rawUrl, width = 400) {
  if (!isValidImageUrl(rawUrl)) return "";
  const trimmed = rawUrl.trim().replace(/^\.\//, "/");
  const safeWidth = Math.max(64, Math.min(1920, Number(width) || 400));

  if (trimmed.includes(`res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`)) {
    if (trimmed.includes("/image/upload/f_auto,q_auto,w_")) {
      return trimmed.replace(
        /\/image\/upload\/f_auto,q_auto,w_\d+,c_limit\//,
        `/image/upload/f_auto,q_auto,w_${safeWidth},c_limit/`
      );
    }
    if (trimmed.includes("/image/upload/f_auto,q_auto/")) {
      return trimmed.replace(
        "/image/upload/f_auto,q_auto/",
        `/image/upload/f_auto,q_auto,w_${safeWidth},c_limit/`
      );
    }
    return trimmed.replace(
      "/image/upload/",
      `/image/upload/f_auto,q_auto,w_${safeWidth},c_limit/`
    );
  }

  return trimmed;
}

/**
 * Shared authoritative product image resolver across Storefront, Cart, Checkout,
 * Customer Dashboard, Order Confirmation, and Admin Dashboard.
 */
export function resolveProductImage(
  itemOrProduct,
  catalogProducts = [],
  options = {}
) {
  const width = Number(options.width) || 400;

  if (typeof itemOrProduct === "string") {
    const direct = optimizeImageUrl(itemOrProduct, width);
    return direct || PRODUCT_IMAGE_PLACEHOLDER;
  }

  if (!itemOrProduct || typeof itemOrProduct !== "object") {
    return PRODUCT_IMAGE_PLACEHOLDER;
  }

  const productId =
    itemOrProduct.productId ??
    itemOrProduct.id ??
    itemOrProduct.parentProductId ??
    "";

  let firstArrayImage = "";
  if (Array.isArray(itemOrProduct.images)) {
    for (const entry of itemOrProduct.images) {
      const urlCandidate =
        typeof entry === "string"
          ? entry
          : entry?.url || entry?.secure_url || entry?.src || "";
      if (isValidImageUrl(urlCandidate)) {
        firstArrayImage = urlCandidate;
        break;
      }
    }
  }

  const candidates = [
    itemOrProduct.productImageSnapshot,
    itemOrProduct.thumbnail,
    itemOrProduct.image,
    firstArrayImage,
    itemOrProduct.img,
    itemOrProduct.giftImage,
  ];

  for (const candidate of candidates) {
    if (isValidImageUrl(candidate)) {
      return optimizeImageUrl(candidate, width);
    }
  }

  // Fallback 1: Match in live catalogProducts if available
  if (productId && Array.isArray(catalogProducts) && catalogProducts.length > 0) {
    const found = catalogProducts.find(
      (p) => String(p?.id) === String(productId)
    );
    if (found) {
      const catalogCandidate =
        found.thumbnail ||
        found.image ||
        (Array.isArray(found.images) ? found.images[0] : "");
      if (isValidImageUrl(catalogCandidate)) {
        return optimizeImageUrl(catalogCandidate, width);
      }
    }
  }

  // Fallback 2: Deterministic Cloudinary catalog product image (IDs 1..194)
  const numericId = Number(productId);
  if (Number.isInteger(numericId) && numericId >= 1 && numericId <= 194) {
    const cloudUrl = getCloudinaryProductImageUrl(numericId);
    if (isValidImageUrl(cloudUrl)) {
      return optimizeImageUrl(cloudUrl, width);
    }
  }

  return PRODUCT_IMAGE_PLACEHOLDER;
}
