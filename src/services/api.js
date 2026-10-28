import axios from "axios";
import { onValue, ref, set } from "firebase/database";
import { db } from "../../firebase.config";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 6000,
  withCredentials: true,
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
  return config;
});

// ============================================================================
// 1. DEFAULT COUPONS & CMS BANNERS
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
      image: "/images/SLIDER.png",
    },
    {
      id: 2,
      tag: "",
      title: "",
      subtitle: "",
      ctaText: "",
      ctaLink: "/shop",
      image: "/images/SLIDER2.png",
    },
    {
      id: 3,
      tag: "",
      title: "",
      subtitle: "",
      ctaText: "",
      ctaLink: "/shop",
      image: "/images/SLIDER3.png",
    },
    {
      id: 4,
      tag: "",
      title: "",
      subtitle: "",
      ctaText: "",
      ctaLink: "/shop",
      image: "/images/SLIDER4.png",
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
      image: "/images/startingImage1.png",
    },
    {
      id: 2,
      subtitle: "STARTING AT $39",
      title: "Men’s Sportswear",
      ctaText: "SHOP NOW",
      categoryFilter: "mens-shoes",
      bgColor: "#f5f5f5",
      textColor: "black",
      image: "/images/startingImage2.png",
    },
  ],
  shopHeader: {
    title: "ALL COLLECTIONS",
    subtitle: "",
    image: "",
  },
};

// ============================================================================
// 2. IN-MEMORY CATALOG CACHE & IN-FLIGHT DEDUPLICATION (HIGH-CONCURRENCY SAFE)
// ============================================================================
let cachedBaseProducts = null;
let lastFetchTimestamp = 0;
let inFlightCatalogPromise = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export function invalidateCatalogCache() {
  cachedBaseProducts = null;
  lastFetchTimestamp = 0;
}

// ============================================================================
// 3. STORE CONFIG HELPERS (LOCALSTORAGE + FIREBASE REALTIME SYNC)
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
  set(ref(db, "storeConfig/coupons"), coupons).catch(() => {});
}

function sanitizeBanners(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_BANNERS;
  const merged = { ...DEFAULT_BANNERS, ...raw };
  if (Array.isArray(merged.heroSlides)) {
    merged.heroSlides = merged.heroSlides.map((s, idx) => {
      const fallbackImg = `/images/SLIDER${idx === 0 ? "" : idx + 1}.png`;
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
    const saved = localStorage.getItem("ummo_admin_banners_v2");
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
  localStorage.setItem("ummo_admin_banners_v2", JSON.stringify(clean));
  set(ref(db, "storeConfig/banners"), clean).catch(() => {});
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
  set(ref(db, "storeConfig/customProducts"), products).catch(() => {});
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
  set(ref(db, "storeConfig/deletedIds"), ids).catch(() => {});
}

/**
 * Subscribe to Firebase `storeConfig` so changes made by Admin on one device
 * automatically propagate to all connected visitors in real time.
 */
let storeConfigSubscribed = false;
export function initStoreConfigSync(onCatalogChanged) {
  if (storeConfigSubscribed) return;
  storeConfigSubscribed = true;

  try {
    onValue(ref(db, "storeConfig"), (snapshot) => {
      if (!snapshot.exists()) return;
      const val = snapshot.val();
      if (val.coupons && Array.isArray(val.coupons)) {
        localStorage.setItem("ummo_admin_coupons", JSON.stringify(val.coupons));
      }
      if (val.banners && typeof val.banners === "object") {
        const cleanBanners = sanitizeBanners(val.banners);
        localStorage.setItem(
          "ummo_admin_banners_v2",
          JSON.stringify(cleanBanners)
        );
        window.dispatchEvent(
          new CustomEvent("ummo:banners-updated", { detail: cleanBanners })
        );
      }
      if (val.customProducts && Array.isArray(val.customProducts)) {
        localStorage.setItem(
          "ummo_admin_custom_products",
          JSON.stringify(val.customProducts)
        );
      }
      if (val.deletedIds && Array.isArray(val.deletedIds)) {
        localStorage.setItem(
          "ummo_admin_deleted_ids",
          JSON.stringify(val.deletedIds)
        );
      }
      if (typeof onCatalogChanged === "function" && cachedBaseProducts) {
        onCatalogChanged(mergeWithAdminCatalog(cachedBaseProducts));
      }
    });
  } catch {
    // Non-blocking if offline
  }
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

  for (const item of baseProducts) {
    const idStr = String(item.id);
    if (deletedIds.has(idStr)) continue;
    if (customMap.has(idStr)) {
      merged.push({ ...item, ...customMap.get(idStr) });
    } else {
      merged.push(item);
    }
  }

  return merged;
}

/**
 * Fetches the product catalog with:
 * - In-Memory Cache (5-minute TTL)
 * - In-Flight Promise Deduplication (multiple components mounting simultaneously share 1 request)
 * - Automatic fallback to DummyJSON and Admin Catalog overlay
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
    try {
      if (import.meta.env.VITE_API_BASE_URL) {
        const response = await apiClient.get(`/products?limit=200`);
        if (response.data?.data?.products?.length) {
          cachedBaseProducts = response.data.data.products;
          lastFetchTimestamp = Date.now();
          return cachedBaseProducts;
        }
      }
    } catch {
      // Fallback to DummyJSON
    }

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

/**
 * Submits an order to the Enterprise Backend API (server-side price & stock verification)
 */
export async function submitBackendOrder(orderPayload) {
  const response = await apiClient.post("/orders/checkout", orderPayload, {
    headers: {
      "Idempotency-Key": crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`,
    },
  });
  return response.data;
}
