import axios from "axios";
import {
  getCloudinaryBannerUrl,
  getCloudinaryProductImageUrl,
} from "./cloudinary";
import { INITIAL_CATALOG_SEED } from "./catalogSeed";
import {
  classifyProductTaxonomy,
  saveCustomTaxonomyOverrides,
} from "../utils/categoryTaxonomy";

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
      const adminToken =
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("ummo_admin_session_token")) ||
        localStorage.getItem("ummo_admin_session_token") ||
        "";
      if (activeUser?.uid) {
        config.headers["X-User-Uid"] = String(activeUser.uid);
      }
      if (activeUser?.email) {
        config.headers["X-User-Email"] = String(activeUser.email);
      }
      if (adminToken) {
        config.headers["X-Admin-Token"] = adminToken;
      }
    }
  } catch {
    // ignore storage access errors
  }
  return config;
});

export async function loginAdminWithServer(email, password) {
  const response = await apiClient.post("/admin/login", { email, password });
  return response.data;
}

export async function logoutAdminWithServer() {
  const response = await apiClient.post("/admin/logout");
  return response.data;
}

export async function verifyAdminSessionWithServer() {
  const response = await apiClient.get("/admin/session");
  return response.data;
}

// ============================================================================
// 1. DEFAULT COUPONS & CLOUDINARY-HOSTED CMS BANNERS
// ============================================================================
export const DEFAULT_COUPONS = [
  {
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    minOrder: 30,
    maxUsesPerUser: 1,
    description: "10% off on orders above $30",
    active: true,
  },
  {
    code: "UMMO20",
    type: "fixed",
    value: 20,
    minOrder: 100,
    maxUsesPerUser: 1,
    description: "$20 flat discount on orders above $100",
    active: true,
  },
  {
    code: "VIP25",
    type: "percentage",
    value: 25,
    minOrder: 200,
    maxUsesPerUser: 1,
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
      image: "/images/slider-hero.webp",
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
// 2. IN-MEMORY CATALOG CACHE
// ============================================================================
let cachedBaseProducts = null;
let cachedMergedCatalog = null;
let cachedMergedCatalogKey = null;

function getCatalogCacheKey() {
  try {
    if (typeof localStorage === "undefined") return "ssr";
    const cp = localStorage.getItem("ummo_admin_custom_products") || "";
    const del = localStorage.getItem("ummo_admin_deleted_ids") || "";
    const camp = localStorage.getItem("ummo_admin_discount_campaigns") || "";
    const tax = localStorage.getItem("ummo_admin_custom_taxonomy_v1") || "";
    return `${cp.length}:${del.length}:${camp.length}:${tax.length}:${cp.slice(0, 64)}:${camp.slice(0, 64)}`;
  } catch {
    return "default";
  }
}

export function invalidateCatalogCache() {
  cachedBaseProducts = null;
  cachedMergedCatalog = null;
  cachedMergedCatalogKey = null;
}

// ============================================================================
// 3. MONGODB ATLAS STORE CONFIG HELPERS
// ============================================================================
let lastLocalConfigWriteAt = 0;
export function markLocalConfigWrite() {
  lastLocalConfigWriteAt = Date.now();
}

export function mergeCouponsWithDefaults(customList = []) {
  const arr = Array.isArray(customList) ? customList : [];
  const seen = new Set(
    arr.map((c) => String(c?.code || "").toUpperCase()).filter(Boolean)
  );
  const merged = [...arr];
  for (const def of DEFAULT_COUPONS) {
    if (!seen.has(def.code.toUpperCase())) {
      merged.push(def);
    }
  }
  return merged;
}

export function getStoredCoupons() {
  try {
    const saved = localStorage.getItem("ummo_admin_coupons");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        return mergeCouponsWithDefaults(parsed);
      }
    }
  } catch {
    // ignore
  }
  localStorage.setItem("ummo_admin_coupons", JSON.stringify(DEFAULT_COUPONS));
  return DEFAULT_COUPONS;
}

export function saveStoredCoupons(coupons) {
  markLocalConfigWrite();
  localStorage.setItem("ummo_admin_coupons", JSON.stringify(coupons));
  window.dispatchEvent(
    new CustomEvent("ummo:coupons-updated", { detail: coupons })
  );
  return apiClient.post("/store-config", { coupons }).catch(() => {});
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
  markLocalConfigWrite();
  const clean = sanitizeBanners(banners);
  localStorage.setItem("ummo_admin_banners_v3", JSON.stringify(clean));
  window.dispatchEvent(
    new CustomEvent("ummo:banners-updated", { detail: clean })
  );
  return apiClient.post("/store-config", { banners: clean }).catch(() => {});
}

export function getCustomAdminProducts() {
  try {
    const saved = localStorage.getItem("ummo_admin_custom_products");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

const catalogSubscribers = new Set();

function notifyCatalogSubscribers() {
  cachedMergedCatalog = null;
  cachedMergedCatalogKey = null;
  const merged = getInitialCatalogSnapshot();
  catalogSubscribers.forEach((cb) => {
    try {
      cb(merged);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function saveCustomAdminProducts(products) {
  markLocalConfigWrite();
  localStorage.setItem("ummo_admin_custom_products", JSON.stringify(products));
  notifyCatalogSubscribers();
  return apiClient
    .post("/store-config", { customProducts: products })
    .catch(() => {});
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
  markLocalConfigWrite();
  localStorage.setItem("ummo_admin_deleted_ids", JSON.stringify(ids));
  notifyCatalogSubscribers();
  return apiClient.post("/store-config", { deletedIds: ids }).catch(() => {});
}

export function saveStoreConfigPatch(patch = {}) {
  markLocalConfigWrite();
  if (Array.isArray(patch.customProducts)) {
    localStorage.setItem(
      "ummo_admin_custom_products",
      JSON.stringify(patch.customProducts)
    );
  }
  if (Array.isArray(patch.deletedIds)) {
    localStorage.setItem(
      "ummo_admin_deleted_ids",
      JSON.stringify(patch.deletedIds)
    );
  }
  if (Array.isArray(patch.coupons)) {
    localStorage.setItem("ummo_admin_coupons", JSON.stringify(patch.coupons));
    window.dispatchEvent(
      new CustomEvent("ummo:coupons-updated", { detail: patch.coupons })
    );
  }
  if (patch.banners && typeof patch.banners === "object") {
    const clean = sanitizeBanners(patch.banners);
    localStorage.setItem("ummo_admin_banners_v3", JSON.stringify(clean));
    window.dispatchEvent(
      new CustomEvent("ummo:banners-updated", { detail: clean })
    );
  }
  notifyCatalogSubscribers();
  return apiClient.post("/store-config", patch).catch(() => {});
}

export function applyRemoteStoreConfig(val) {
  if (!val || typeof val !== "object") return;
  if (Date.now() - lastLocalConfigWriteAt < 10000) {
    // Do not overwrite recent local Admin writes with an older in-flight GET response
    return;
  }

  let catalogChanged = false;

  if (Array.isArray(val.coupons) && val.coupons.length) {
    const mergedCoupons = mergeCouponsWithDefaults(val.coupons);
    const nextJson = JSON.stringify(mergedCoupons);
    if (localStorage.getItem("ummo_admin_coupons") !== nextJson) {
      localStorage.setItem("ummo_admin_coupons", nextJson);
      window.dispatchEvent(
        new CustomEvent("ummo:coupons-updated", { detail: mergedCoupons })
      );
    }
  }
  if (val.banners && typeof val.banners === "object") {
    const cleanBanners = sanitizeBanners(val.banners);
    const nextJson = JSON.stringify(cleanBanners);
    const prevJson = localStorage.getItem("ummo_admin_banners_v3");
    if (prevJson !== nextJson) {
      localStorage.setItem("ummo_admin_banners_v3", nextJson);
      // Only dispatch banner update if heroSlides or custom image URLs actually changed
      if (prevJson !== null) {
        window.dispatchEvent(
          new CustomEvent("ummo:banners-updated", { detail: cleanBanners })
        );
      }
    }
  }
  if (Array.isArray(val.customProducts)) {
    const nextJson = JSON.stringify(val.customProducts);
    const prevRaw = localStorage.getItem("ummo_admin_custom_products");
    if (prevRaw !== nextJson) {
      localStorage.setItem("ummo_admin_custom_products", nextJson);
      if (
        prevRaw !== null ||
        (typeof window !== "undefined" &&
          window.location?.pathname?.startsWith("/admin"))
      ) {
        catalogChanged = true;
      }
    }
  }
  if (Array.isArray(val.deletedIds)) {
    const nextJson = JSON.stringify(val.deletedIds);
    const prevRaw = localStorage.getItem("ummo_admin_deleted_ids");
    if (prevRaw !== nextJson) {
      localStorage.setItem("ummo_admin_deleted_ids", nextJson);
      if (
        prevRaw !== null ||
        (typeof window !== "undefined" &&
          window.location?.pathname?.startsWith("/admin"))
      ) {
        catalogChanged = true;
      }
    }
  }
  if (val.cartRules && typeof val.cartRules === "object") {
    const nextJson = JSON.stringify(val.cartRules);
    if (localStorage.getItem("ummo_admin_cart_rules_v2") !== nextJson) {
      localStorage.setItem("ummo_admin_cart_rules_v2", nextJson);
      window.dispatchEvent(
        new CustomEvent("ummo:cart-rules-updated", { detail: val.cartRules })
      );
    }
  }
  if (Array.isArray(val.discountCampaigns)) {
    const nextJson = JSON.stringify(val.discountCampaigns);
    const prevJson = localStorage.getItem("ummo_admin_discount_campaigns");
    const baselineJson = prevJson ?? JSON.stringify(DEFAULT_DISCOUNT_CAMPAIGNS);
    if (prevJson !== nextJson) {
      localStorage.setItem("ummo_admin_discount_campaigns", nextJson);
      if (baselineJson !== nextJson) {
        window.dispatchEvent(
          new CustomEvent("ummo:discount-campaigns-updated", {
            detail: val.discountCampaigns,
          })
        );
        catalogChanged = true;
      }
    }
  }
  if (val.customTaxonomy && typeof val.customTaxonomy === "object") {
    const nextJson = JSON.stringify(val.customTaxonomy);
    const prevTaxJson = localStorage.getItem("ummo_admin_custom_taxonomy_v1");
    if (prevTaxJson !== nextJson) {
      saveCustomTaxonomyOverrides(val.customTaxonomy);
      if (
        prevTaxJson !== null ||
        (typeof window !== "undefined" &&
          window.location?.pathname?.startsWith("/admin"))
      ) {
        catalogChanged = true;
      }
    }
  }
  if (catalogChanged) {
    notifyCatalogSubscribers();
  }
}

export const DEFAULT_DISCOUNT_CAMPAIGNS = [
  {
    id: "CAMP-FASHION-FLASH",
    name: "Seasonal Fashion Flash Sale",
    type: "percentage",
    value: 20,
    scope: "department",
    targetDepartment: "women",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-12-31T23:59:59.000Z",
    active: true,
  },
  {
    id: "CAMP-MENS-STYLE",
    name: "Men's Footwear & Apparel Offer",
    type: "percentage",
    value: 15,
    scope: "department",
    targetDepartment: "men",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-12-31T23:59:59.000Z",
    active: true,
  },
  {
    id: "CAMP-KIDS-JOY",
    name: "Kids' Summer Collection Special",
    type: "percentage",
    value: 18,
    scope: "department",
    targetDepartment: "kids",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-12-31T23:59:59.000Z",
    active: true,
  },
];

export function getStoredDiscountCampaigns() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("ummo_admin_discount_campaigns");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_DISCOUNT_CAMPAIGNS;
}

export function saveStoredDiscountCampaigns(campaigns) {
  markLocalConfigWrite();
  const safeList = Array.isArray(campaigns) ? campaigns : [];
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      "ummo_admin_discount_campaigns",
      JSON.stringify(safeList)
    );
  }
  window.dispatchEvent(
    new CustomEvent("ummo:discount-campaigns-updated", { detail: safeList })
  );
  notifyCatalogSubscribers();
  return apiClient
    .post("/store-config", { discountCampaigns: safeList })
    .catch(() => {});
}

/**
 * Syncs store configuration (coupons, banners, customProducts, deletedIds, cartRules)
 * directly from MongoDB Atlas (`/api/v1/store-data`) and notifies all mounted subscribers.
 */
let storeConfigSyncPromise = null;
export function getSyncedUserOrders() {
  try {
    const raw = localStorage.getItem("ummo_synced_user_orders");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function validateCouponOnServer(payload) {
  const response = await apiClient.post("/coupons/validate", payload);
  return response.data;
}

export function initStoreConfigSync(onCatalogChanged) {
  if (typeof onCatalogChanged === "function") {
    catalogSubscribers.add(onCatalogChanged);
  }

  if (!storeConfigSyncPromise) {
    const isAdminRoute =
      typeof window !== "undefined" &&
      window.location?.pathname?.startsWith("/admin");
    const runSync = () =>
      apiClient
        .get("/store-data")
        .then((res) => {
          applyRemoteStoreConfig(res.data?.storeConfig);
          if (Array.isArray(res.data?.orders)) {
            try {
              localStorage.setItem(
                "ummo_synced_user_orders",
                JSON.stringify(res.data.orders)
              );
              window.dispatchEvent(
                new CustomEvent("ummo:orders-synced", {
                  detail: res.data.orders,
                })
              );
            } catch {
              // ignore
            }
          }
          return res.data;
        })
        .catch(() => null);

    storeConfigSyncPromise = isAdminRoute
      ? runSync()
      : new Promise((resolve) => {
          setTimeout(() => {
            runSync().then(resolve);
          }, 2200);
        });
  }

  return () => {
    if (typeof onCatalogChanged === "function") {
      catalogSubscribers.delete(onCatalogChanged);
    }
  };
}

function getDefaultProductTimer(item, index) {
  if (item?.discountEndTime && item.discountEndTime !== "none") {
    return item.discountEndTime;
  }
  const hasGoodDiscount = Number(item?.discountPercentage || 0) >= 12;
  if (index >= 8 && !hasGoodDiscount) return "";
  const dayBucket = Math.floor(Date.now() / (24 * 3600 * 1000));
  const baseMs = (dayBucket + 1) * 24 * 3600 * 1000;
  const offsetHours = ((Number(item?.id || index) * 7) % 36) + 6;
  return new Date(baseMs + offsetHours * 3600 * 1000).toISOString();
}

export function getInitialCatalogSnapshot() {
  if (!cachedBaseProducts) {
    cachedBaseProducts = INITIAL_CATALOG_SEED;
  }
  const key = getCatalogCacheKey();
  if (cachedMergedCatalog && cachedMergedCatalogKey === key) {
    return cachedMergedCatalog;
  }
  cachedMergedCatalog = mergeWithAdminCatalog(cachedBaseProducts);
  cachedMergedCatalogKey = key;
  return cachedMergedCatalog;
}

function applyCampaignsToProduct(product, campaigns, nowMs) {
  if (!Array.isArray(campaigns) || !campaigns.length) return product;
  const tax = classifyProductTaxonomy(product);
  let bestPct = Number(product.discountPercentage || 0);
  let bestFixed = Number(product.discountFixedAmount || 0);
  let bestEndTime = product.discountEndTime || "";
  let bestStartTime = product.discountStartTime || "";
  let appliedCampaignName = product.discountCampaignName || "";

  for (const camp of campaigns) {
    if (!camp || camp.active === false) continue;
    const startMs = camp.startTime ? Date.parse(camp.startTime) : NaN;
    const endMs = camp.endTime ? Date.parse(camp.endTime) : NaN;
    if (Number.isFinite(startMs) && startMs > nowMs) continue;
    if (Number.isFinite(endMs) && endMs <= nowMs) continue;

    let matches = false;
    if (camp.scope === "all") {
      matches = true;
    } else if (camp.scope === "department" && camp.targetDepartment) {
      matches =
        tax.department === String(camp.targetDepartment).toLowerCase() ||
        (Array.isArray(tax.secondaryDepartments) &&
          tax.secondaryDepartments.includes(
            String(camp.targetDepartment).toLowerCase()
          ));
    } else if (camp.scope === "category" && camp.targetCategory) {
      matches =
        String(product.category || "").toLowerCase() ===
        String(camp.targetCategory).toLowerCase();
    } else if (camp.scope === "products" && Array.isArray(camp.productIds)) {
      matches = camp.productIds.map(String).includes(String(product.id));
    }

    if (!matches) continue;

    const val = Number(camp.value || 0);
    if (camp.type === "fixed" && val > 0) {
      const effectivePct =
        product.price > 0 ? Math.round((val / product.price) * 100) : 0;
      if (effectivePct >= bestPct) {
        bestFixed = val;
        bestPct = effectivePct;
        bestEndTime = camp.endTime || bestEndTime;
        bestStartTime = camp.startTime || bestStartTime;
        appliedCampaignName = camp.name || "";
      }
    } else if (val > bestPct) {
      bestPct = val;
      bestFixed = 0;
      bestEndTime = camp.endTime || bestEndTime;
      bestStartTime = camp.startTime || bestStartTime;
      appliedCampaignName = camp.name || "";
    }
  }

  return {
    ...product,
    department: product.department || tax.department,
    subcategory: product.subcategory || tax.subcategory,
    discountPercentage: bestPct,
    ...(bestFixed > 0 ? { discountFixedAmount: bestFixed } : {}),
    discountEndTime: bestEndTime,
    ...(bestStartTime ? { discountStartTime: bestStartTime } : {}),
    ...(appliedCampaignName ? { discountCampaignName: appliedCampaignName } : {}),
  };
}

function mergeWithAdminCatalog(baseProducts) {
  const customProducts = getCustomAdminProducts();
  const deletedIds = new Set(getDeletedProductIds().map(String));
  const campaigns = getStoredDiscountCampaigns();
  const nowMs = Date.now();
  const baseIdSet = new Set(baseProducts.map((p) => String(p.id)));

  const customMap = new Map(customProducts.map((p) => [String(p.id), p]));
  const merged = [];

  for (const cp of customProducts) {
    const cpId = String(cp.id);
    if (!deletedIds.has(cpId) && (cp.isCustomNew || !baseIdSet.has(cpId))) {
      const tax = classifyProductTaxonomy(cp);
      merged.push(
        applyCampaignsToProduct(
          {
            ...cp,
            department: cp.department || tax.department,
            subcategory: cp.subcategory || tax.subcategory,
          },
          campaigns,
          nowMs
        )
      );
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
    const tax = classifyProductTaxonomy(item);

    const enrichedBase = {
      ...item,
      department: item.department || tax.department,
      subcategory: item.subcategory || tax.subcategory,
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
      const combined = {
        ...enrichedBase,
        ...adminOverride,
        discountEndTime:
          adminOverride.discountEndTime !== undefined
            ? adminOverride.discountEndTime
            : enrichedBase.discountEndTime,
      };
      const overrideTax = classifyProductTaxonomy(combined);
      merged.push(
        applyCampaignsToProduct(
          {
            ...combined,
            department: adminOverride.department || overrideTax.department,
            subcategory: adminOverride.subcategory || overrideTax.subcategory,
          },
          campaigns,
          nowMs
        )
      );
    } else {
      merged.push(applyCampaignsToProduct(enrichedBase, campaigns, nowMs));
    }
  });

  return merged;
}

/**
 * Fetches the product catalog with Cloudinary-hosted product images and MongoDB Admin overrides.
 * Uses the complete 194-product local seed synchronously to eliminate external third-party API latency.
 */
export async function fetchCatalogProducts(limit = 200) {
  const full = getInitialCatalogSnapshot();
  return limit >= full.length ? full : full.slice(0, limit);
}

// ============================================================================
// 4. MONGODB ATLAS DATA OPERATIONS (ORDERS, PAYMENTS, USERS, REVIEWS, ADDRESSES)
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

export async function fetchPaymentGatewaysConfig() {
  const response = await apiClient.get("/payments/config");
  return response.data;
}

export async function initiatePaymentSession(orderId, gateway = "sslcommerz") {
  const originUrl =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  if (gateway === "stripe") {
    const response = await apiClient.post("/payments/stripe/create-session", {
      orderId,
      originUrl,
    });
    return response.data;
  }
  const response = await apiClient.post("/payments/sslcommerz/init", {
    orderId,
    originUrl,
  });
  return response.data;
}

export async function confirmSandboxPayment(payload) {
  const response = await apiClient.post("/payments/sandbox-confirm", payload);
  return response.data;
}

export async function reconcileOrderPaymentInMongo(payload) {
  const response = await apiClient.post("/payments/reconcile", payload);
  return response.data;
}

export async function refundOrderPaymentInMongo(payload) {
  const response = await apiClient.post("/payments/refund", payload);
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

export async function updateUserRoleInMongo(uid, role, extra = {}) {
  const response = await apiClient.patch("/users/role", {
    uid,
    role,
    ...extra,
  });
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
