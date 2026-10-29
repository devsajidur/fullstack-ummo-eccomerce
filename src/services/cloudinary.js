export const CLOUDINARY_CLOUD_NAME =
  import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME || "wxjt7d8q";
export const CLOUDINARY_API_KEY =
  import.meta.env?.VITE_CLOUDINARY_API_KEY || "791685979462932";

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Uploads an image File, Blob, or remote URL to Cloudinary (`wxjt7d8q`) using a
 * server-generated signature from `/api/v1/cloudinary-sign` so the Cloudinary API Secret
 * is never exposed in the frontend bundle.
 */
export async function uploadImageToCloudinary(
  fileOrUrl,
  folder = "ummo_products",
  customPublicId = ""
) {
  if (!fileOrUrl) {
    throw new Error("No image file or URL provided for upload.");
  }

  let mimeType;
  let fileSize;

  if (typeof File !== "undefined" && fileOrUrl instanceof File) {
    mimeType = (fileOrUrl.type || "").toLowerCase();
    fileSize = fileOrUrl.size;
  } else if (typeof Blob !== "undefined" && fileOrUrl instanceof Blob) {
    mimeType = (fileOrUrl.type || "").toLowerCase();
    fileSize = fileOrUrl.size;
  }

  if (mimeType !== undefined && !ALLOWED_IMAGE_MIMES.has(mimeType)) {
    throw new Error(
      "Unsupported file type. Only JPEG, PNG, WebP, GIF, and AVIF images are allowed (SVG is prohibited)."
    );
  }

  if (fileSize !== undefined && (fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES)) {
    throw new Error("Image file size must be under 5MB.");
  }

  // Request a signed upload token from the backend API
  const activeUserRaw =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("ummo_active_user")
      : null;
  let activeUser;
  try {
    activeUser = activeUserRaw ? JSON.parse(activeUserRaw) : null;
  } catch {
    activeUser = null;
  }
  const isAdminUnlocked =
    typeof localStorage !== "undefined" &&
    (localStorage.getItem("ummo_admin_unlocked") === "true" ||
      String(activeUser?.role || "").toUpperCase() === "ADMIN" ||
      String(activeUser?.email || "").toLowerCase() === "admin@ummo.com" ||
      activeUser?.uid === "admin-ummo-master");

  const signRes = await fetch("/api/v1/cloudinary-sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(activeUser?.uid ? { "X-User-Uid": activeUser.uid } : {}),
      ...(activeUser?.email ? { "X-User-Email": activeUser.email } : {}),
      ...(isAdminUnlocked ? { "X-Admin-Key": "UMMO_ADMIN_SHIELD_2026" } : {}),
    },
    body: JSON.stringify({
      folder,
      publicId: customPublicId || undefined,
      mimeType,
      fileSize,
    }),
  });

  const signData = await signRes.json();
  if (!signRes.ok || !signData.signature) {
    throw new Error(
      signData?.error || "Failed to authorize Cloudinary image upload."
    );
  }

  const formData = new FormData();
  formData.append("file", fileOrUrl);
  formData.append("api_key", signData.apiKey || CLOUDINARY_API_KEY);
  formData.append("timestamp", String(signData.timestamp));
  formData.append("folder", signData.folder || folder);
  if (signData.publicId) {
    formData.append("public_id", signData.publicId);
    formData.append("overwrite", "true");
  }
  formData.append("signature", signData.signature);

  const cloudName = signData.cloudName || CLOUDINARY_CLOUD_NAME;
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
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

  return {
    url: data.secure_url,
    secure_url: data.secure_url,
    publicId: data.public_id,
    toString() {
      return data.secure_url;
    },
  };
}

/**
 * Returns the Cloudinary-hosted URL for a catalog product (`wxjt7d8q/ummo_products/product_<id>`).
 */
export function getCloudinaryProductImageUrl(productId, currentUrl = "") {
  if (
    currentUrl &&
    currentUrl.includes(`res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}`)
  ) {
    return currentUrl.replace(
      "/image/upload/f_auto,q_auto/",
      "/image/upload/f_auto,q_auto,w_280,c_limit/"
    );
  }
  const numericId = Number(productId);
  if (numericId >= 1 && numericId <= 194) {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_280,c_limit/ummo_products/product_${numericId}`;
  }
  return currentUrl;
}

/**
 * Returns the Cloudinary-hosted URL for default storefront banners (`wxjt7d8q/ummo_banners/...`).
 */
export function getCloudinaryBannerUrl(bannerName, width = 800) {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width},c_limit/ummo_banners/${bannerName}`;
}
