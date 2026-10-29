export const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "wxjt7d8q";
export const CLOUDINARY_API_KEY =
  import.meta.env.VITE_CLOUDINARY_API_KEY || "791685979462932";
export const CLOUDINARY_API_SECRET =
  import.meta.env.VITE_CLOUDINARY_API_SECRET || "s6TJSmCrjAMjwOkTX_W7N7PkPFo";

/**
 * Computes SHA-1 hex signature using the browser's native Web Crypto API
 * so signed uploads to Cloudinary work directly from both client and server.
 */
async function sha1Hex(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Uploads a File, Blob, Base64 Data URL, or remote image URL directly to Cloudinary (`wxjt7d8q`).
 * Returns the secure HTTPS Cloudinary URL.
 */
export async function uploadImageToCloudinary(
  fileOrUrl,
  folder = "ummo_products",
  customPublicId = ""
) {
  if (!fileOrUrl) {
    throw new Error("No image file or URL provided for upload.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder,
    timestamp: String(timestamp),
  };

  if (customPublicId) {
    paramsToSign.overwrite = "true";
    paramsToSign.public_id = customPublicId;
  }

  const sortedKeys = Object.keys(paramsToSign).sort();
  const stringToSign =
    sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join("&") +
    CLOUDINARY_API_SECRET;

  const signature = await sha1Hex(stringToSign);

  const formData = new FormData();
  formData.append("file", fileOrUrl);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", String(timestamp));
  formData.append("folder", folder);
  if (customPublicId) {
    formData.append("public_id", customPublicId);
    formData.append("overwrite", "true");
  }
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();
  if (!response.ok || !data.secure_url) {
    throw new Error(
      data?.error?.message || "Failed to upload image to Cloudinary."
    );
  }

  return data.secure_url;
}

/**
 * Returns the Cloudinary-hosted URL for a catalog product (`wxjt7d8q/ummo_products/product_<id>`).
 */
export function getCloudinaryProductImageUrl(productId, currentUrl = "") {
  if (
    currentUrl &&
    currentUrl.includes(`res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}`)
  ) {
    return currentUrl;
  }
  const numericId = Number(productId);
  if (numericId >= 1 && numericId <= 194) {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto/ummo_products/product_${numericId}`;
  }
  return currentUrl;
}

/**
 * Returns the Cloudinary-hosted URL for default storefront banners (`wxjt7d8q/ummo_banners/...`).
 */
export function getCloudinaryBannerUrl(bannerName) {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto/ummo_banners/${bannerName}`;
}
