import axios from "axios";
import {
  getCloudinaryBannerUrl,
  getCloudinaryProductImageUrl,
} from "./cloudinary";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  try {
    if (typeof localStorage !== "undefined") {
      const rawUser = localStorage.getItem("ummo_active_user");
      const activeUser = rawUser ? JSON.parse(rawUser) : null;
      if (activeUser?.uid) {
        config.headers["X-User-Uid"] = String(activeUser.uid);
      }
      if (activeUser?.email) {
        config.headers["X-User-Email"] = String(activeUser.email);
      }
      const isAdminUnlocked =
        localStorage.getItem("ummo_admin_unlocked") === "true" ||
        String(activeUser?.role || "").toUpperCase() === "ADMIN";
      if (isAdminUnlocked) {
        config.headers["X-Admin-Key"] = "UMMO_ADMIN_SHIELD_2026";
      }
    }
  } catch {
    // ignore storage access errors
  }
  return config;
});

// ============================================================================
// 1. DEFAULT COUPONS & CLOUDINARY-HOSTED CMS BANNERS
// ============================================================================
export const DEFAULT_COUPONS = [
  {
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    minOrder: 30,
    description: "10% off on orders above $30",
    active: true,
  },
  {
    code: "UMMO20",
    type: "fixed",
    value: 20,
    minOrder: 100,
    description: "$20 flat discount on orders above $100",
    active: true,
  },
  {
    code: "VIP25",
    type: "percentage",
    value: 25,
    minOrder: 200,
    description: "25% VIP discount on orders above $200",
    active: true,
  },
];

export const DEFAULT_BANNERS = {
  heroSlides: [
    {
      id: 1,
      tag: "",
      title: "",
      subtitle: "",
      ctaText: "",
      ctaLink: "/shop",
      image: getCloudinaryBannerUrl("SLIDER"),
    },
    {
      id: 2,
      tag: "",
      title: "",
      subtitle: "",
      ctaText: "",
      ctaLink: "/shop",
      image: getCloudinaryBannerUrl("SLIDER2"),
    },
    {
      id: 3,
      tag: "",
      title: "",
      subtitle: "",
      ctaText: "",
      ctaLink: "/shop",
      image: getCloudinaryBannerUrl("SLIDER3"),
    },
    {
      id: 4,
      tag: "",
      title: "",
      subtitle: "",
      ctaText: "",
      ctaLink: "/shop",
      image: getCloudinaryBannerUrl("SLIDER4"),
    },
  ],
  dealBanner: {
    tag: "DEAL OF THE WEEK",
    titleBold: "Spring",
    titleRegular: "Collection",
    ctaText: "SHOP NOW",
    ctaLink: "/shop",
    countdownDate: "2026-12-31T23:59:59.000Z",
    bgColor: "#ebebeb",
    image: "",
  },
  promoCards: [
    {
      id: 1,
      subtitle: "STARTING AT $39",
      title: "Women’s Dresses",
      ctaText: "SHOP NOW",
      categoryFilter: "womens-dresses",
      bgColor: "#D6001C",
      textColor: "white",
      image: getCloudinaryBannerUrl("startingImage1"),
    },
    {
      id: 2,
      subtitle: "STARTING AT $39",
      title: "Men’s Sportswear",
      ctaText: "SHOP NOW",
      categoryFilter: "mens-shoes",
      bgColor: "#f5f5f5",
      textColor: "black",
      image: getCloudinaryBannerUrl("startingImage2"),
    },
  ],
  shopHeader: {
    title: "ALL COLLECTIONS",
    subtitle: "",
    image: "",
  },
};

// ============================================================================
// 2. IN-MEMORY CATALOG CACHE & IN-FLIGHT DEDUPLICATION
// ============================================================================
let cachedBaseProducts = null;
let lastFetchTimestamp = 0;
let inFlightCatalogPromise = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateCatalogCache() {
  cachedBaseProducts = null;
  lastFetchTimestamp = 0;
}

// ============================================================================
// 3. MONGODB ATLAS STORE CONFIG HELPERS
// ============================================================================
export function getStoredCoupons() {
  try {
    const saved = localStorage.getItem("ummo_admin_coupons");
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  localStorage.setItem("ummo_admin_coupons", JSON.stringify(DEFAULT_COUPONS));
  return DEFAULT_COUPONS;
}

export function saveStoredCoupons(coupons) {
  localStorage.setItem("ummo_admin_coupons", JSON.stringify(coupons));
  apiClient.post("/store-config", { coupons }).catch(() => {});
}

function sanitizeBanners(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_BANNERS;
  const merged = { ...DEFAULT_BANNERS, ...raw };
  if (Array.isArray(merged.heroSlides)) {
    merged.heroSlides = merged.heroSlides.map((s, idx) => {
      const fallbackImg = getCloudinaryBannerUrl(
        `SLIDER${idx === 0 ? "" : idx + 1}`
      );
      const isBrokenLegacy =
        !s.image ||
        s.image.includes("banner.png") ||
        s.image.includes("banner2.png") ||
        s.image.includes("banner3.png");
      if (isBrokenLegacy) {
        return {
          ...s,
          image: fallbackImg,
          tag: "",
          title: "",
          subtitle: "",
          ctaText: "",
        };
      }
      return s;
    });
  }
  return merged;
}

export function getStoredBanners() {
  try {
    const saved = localStorage.getItem("ummo_admin_banners_v3");
    if (saved) {
      return sanitizeBanners(JSON.parse(saved));
    }
  } catch {
    // ignore
  }
  return DEFAULT_BANNERS;
}

export function saveStoredBanners(banners) {
  const clean = sanitizeBanners(banners);
  localStorage.setItem("ummo_admin_banners_v3", JSON.stringify(clean));
  apiClient.post("/store-config", { banners: clean }).catch(() => {});
  window.dispatchEvent(
    new CustomEvent("ummo:banners-updated", { detail: clean })
  );
}

export function getCustomAdminProducts() {
  try {
    const saved = localStorage.getItem("ummo_admin_custom_products");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveCustomAdminProducts(products) {
  localStorage.setItem("ummo_admin_custom_products", JSON.stringify(products));
  apiClient.post("/store-config", { customProducts: products }).catch(() => {});
}

export function getDeletedProductIds() {
  try {
    const saved = localStorage.getItem("ummo_admin_deleted_ids");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveDeletedProductIds(ids) {
  localStorage.setItem("ummo_admin_deleted_ids", JSON.stringify(ids));
  apiClient.post("/store-config", { deletedIds: ids }).catch(() => {});
}

/**
 * Syncs store configuration (coupons, banners, customProducts, deletedIds, cartRules)
 * directly from MongoDB Atlas (`/api/v1/store-data`).
 */
let storeConfigSubscribed = false;
export function initStoreConfigSync(onCatalogChanged) {
  if (storeConfigSubscribed) return;
  storeConfigSubscribed = true;

  apiClient
    .get("/store-data")
    .then((res) => {
      const val = res.data?.storeConfig;
      if (!val || typeof val !== "object") return;

      if (Array.isArray(val.coupons) && val.coupons.length) {
        localStorage.setItem("ummo_admin_coupons", JSON.stringify(val.coupons));
      }
      if (val.banners && typeof val.banners === "object") {
        const cleanBanners = sanitizeBanners(val.banners);
        localStorage.setItem(
          "ummo_admin_banners_v3",
          JSON.stringify(cleanBanners)
        );
        window.dispatchEvent(
          new CustomEvent("ummo:banners-updated", { detail: cleanBanners })
        );
      }
      if (Array.isArray(val.customProducts)) {
        localStorage.setItem(
          "ummo_admin_custom_products",
          JSON.stringify(val.customProducts)
        );
      }
      if (Array.isArray(val.deletedIds)) {
        localStorage.setItem(
          "ummo_admin_deleted_ids",
          JSON.stringify(val.deletedIds)
        );
      }
      if (val.cartRules && typeof val.cartRules === "object") {
        localStorage.setItem(
          "ummo_admin_cart_rules_v2",
          JSON.stringify(val.cartRules)
        );
        window.dispatchEvent(
          new CustomEvent("ummo:cart-rules-updated", { detail: val.cartRules })
        );
      }
      if (typeof onCatalogChanged === "function" && cachedBaseProducts) {
        onCatalogChanged(mergeWithAdminCatalog(cachedBaseProducts));
      }
    })
    .catch(() => {});
}

function getDefaultProductTimer(item, index) {
  const disc = Number(item?.discountPercentage || 0);
  if (disc < 10 && index >= 8) return "";
  const dayBucket = Math.floor(Date.now() / (24 * 3600 * 1000));
  const baseMs = (dayBucket + 1) * 24 * 3600 * 1000;
  const offsetHours = ((Number(item?.id || index) * 7) % 36) + 6;
  return new Date(baseMs + offsetHours * 3600 * 1000).toISOString();
}

function mergeWithAdminCatalog(baseProducts) {
  const customProducts = getCustomAdminProducts();
  const deletedIds = new Set(getDeletedProductIds().map(String));

  const customMap = new Map(customProducts.map((p) => [String(p.id), p]));
  const merged = [];

  for (const cp of customProducts) {
    if (!deletedIds.has(String(cp.id)) && cp.isCustomNew) {
      merged.push(cp);
    }
  }

  baseProducts.forEach((item, index) => {
    const idStr = String(item.id);
    if (deletedIds.has(idStr)) return;
    const defaultTimer = getDefaultProductTimer(item, index);
    const defaultDiscount =
      Number(item.discountPercentage || 0) < 10 && index < 8
        ? 15
        : Number(item.discountPercentage || 0);

    // Every catalog product image is served directly from the user's Cloudinary (`wxjt7d8q`)
    const cloudinaryThumb = getCloudinaryProductImageUrl(
      item.id,
      item.thumbnail
    );

    const enrichedBase = {
      ...item,
      thumbnail: cloudinaryThumb,
      images: [
        cloudinaryThumb,
        ...(Array.isArray(item.images) ? item.images.slice(1) : []),
      ],
      discountPercentage: defaultDiscount,
      discountEndTime: defaultTimer,
    };

    if (customMap.has(idStr)) {
      const adminOverride = customMap.get(idStr);
      merged.push({
        ...enrichedBase,
        ...adminOverride,
        discountEndTime:
          adminOverride.discountEndTime !== undefined
            ? adminOverride.discountEndTime
            : enrichedBase.discountEndTime,
      });
    } else {
      merged.push(enrichedBase);
    }
  });

  return merged;
}

/**
 * Fetches the product catalog with Cloudinary-hosted product images and MongoDB Admin overrides.
 */
export async function fetchCatalogProducts(limit = 200) {
  const now = Date.now();
  if (cachedBaseProducts && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return mergeWithAdminCatalog(cachedBaseProducts).slice(0, limit);
  }

  if (inFlightCatalogPromise) {
    const base = await inFlightCatalogPromise;
    return mergeWithAdminCatalog(base).slice(0, limit);
  }

  inFlightCatalogPromise = (async () => {
    const fallback = await axios.get(
      `https://dummyjson.com/products?limit=200`
    );
    cachedBaseProducts = fallback.data?.products || [];
    lastFetchTimestamp = Date.now();
    return cachedBaseProducts;
  })();

  try {
    const baseList = await inFlightCatalogPromise;
    return mergeWithAdminCatalog(baseList).slice(0, limit);
  } finally {
    inFlightCatalogPromise = null;
  }
}

// ============================================================================
// 4. MONGODB ATLAS DATA OPERATIONS (ORDERS, USERS, REVIEWS, ADDRESSES, INBOX)
// ============================================================================
export async function fetchStoreDataFromMongo(params = {}) {
  const response = await apiClient.get("/store-data", { params });
  return response.data;
}

export async function submitBackendOrder(orderPayload) {
  const response = await apiClient.post("/orders", orderPayload, {
    headers: {
      "Idempotency-Key": crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`,
    },
  });
  return response.data;
}

export async function updateOrderStatusInMongo(orderId, statusOrUid, maybeStatus) {
  const status = maybeStatus !== undefined ? maybeStatus : statusOrUid;
  const response = await apiClient.patch("/orders/status", { orderId, status });
  return response.data;
}

export async function syncUserToMongo(userPayload) {
  const response = await apiClient.post("/users", userPayload);
  return response.data;
}

export async function updateUserRoleInMongo(uid, role) {
  const response = await apiClient.patch("/users/role", { uid, role });
  return response.data;
}

export async function fetchUserAddressesFromMongo(userUid) {
  const response = await apiClient.get("/addresses", { params: { userUid } });
  return response.data?.addresses || [];
}

export async function saveUserAddressesToMongo(userUid, addresses) {
  const response = await apiClient.post("/addresses", { userUid, addresses });
  return response.data?.addresses || [];
}

export async function fetchProductReviewsFromMongo(productId) {
  const response = await apiClient.get("/reviews", { params: { productId } });
  return response.data?.reviews || [];
}

export async function saveProductReviewToMongo(productId, review) {
  const response = await apiClient.post("/reviews", { productId, review });
  return response.data?.reviews || [];
}

export async function submitContactMessageToMongo(messagePayload) {
  const response = await apiClient.post("/messages", messagePayload);
  return response.data;
}

export async function deleteContactMessageFromMongo(id) {
  const response = await apiClient.delete("/messages", { params: { id } });
  return response.data;
}

export async function submitSubscriberToMongo(email) {
  const response = await apiClient.post("/subscribers", { email });
  return response.data;
}

export async function deleteSubscriberFromMongo(id) {
  const response = await apiClient.delete("/subscribers", { params: { id } });
  return response.data;
}
