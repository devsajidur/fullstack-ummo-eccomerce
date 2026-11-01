import { saveCustomTaxonomyOverrides } from "../../utils/categoryTaxonomy";
import { apiClient } from "./httpClient";
import {
  DEFAULT_DISCOUNT_CAMPAIGNS,
  getStoredBanners,
  mergeCouponsWithDefaults,
  sanitizeBanners,
  sanitizeFeaturedCollection,
} from "./storeDefaults";
import {
  notifyCatalogSubscribers,
  subscribeToCatalogChanges,
} from "./catalogEngine";

let lastLocalConfigWriteAt = 0;
export function markLocalConfigWrite() {
  lastLocalConfigWriteAt = Date.now();
}

export function saveStoredCoupons(coupons) {
  markLocalConfigWrite();
  localStorage.setItem("ummo_admin_coupons", JSON.stringify(coupons));
  window.dispatchEvent(
    new CustomEvent("ummo:coupons-updated", { detail: coupons })
  );
  return apiClient.post("/store-config", { coupons }).catch(() => {});
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

export function saveStoredFeaturedCollection(config) {
  markLocalConfigWrite();
  const currentBanners = getStoredBanners();
  const clean = sanitizeFeaturedCollection(config, currentBanners?.dealBanner);
  const syncedBanners = sanitizeBanners({
    ...currentBanners,
    dealBanner: {
      ...(currentBanners?.dealBanner || {}),
      tag: clean.tag,
      titleBold: clean.titleBold,
      titleRegular: clean.titleRegular,
      ctaText: clean.ctaText,
      ctaLink: "/featured",
      countdownDate: clean.timerEnabled ? clean.countdownDate : "",
      bgColor: clean.bgColor,
      image: clean.image,
    },
  });

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      "ummo_admin_featured_collection_v1",
      JSON.stringify(clean)
    );
    localStorage.setItem(
      "ummo_admin_banners_v3",
      JSON.stringify(syncedBanners)
    );
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ummo:featured-collection-updated", { detail: clean })
    );
    window.dispatchEvent(
      new CustomEvent("ummo:banners-updated", { detail: syncedBanners })
    );
  }
  notifyCatalogSubscribers();
  return apiClient
    .post("/store-config", {
      featuredCollection: clean,
      banners: syncedBanners,
    })
    .catch(() => {});
}

export function saveCustomAdminProducts(products) {
  markLocalConfigWrite();
  localStorage.setItem("ummo_admin_custom_products", JSON.stringify(products));
  notifyCatalogSubscribers();
  return apiClient
    .post("/store-config", { customProducts: products })
    .catch(() => {});
}

export function saveDeletedProductIds(ids) {
  markLocalConfigWrite();
  localStorage.setItem("ummo_admin_deleted_ids", JSON.stringify(ids));
  notifyCatalogSubscribers();
  return apiClient.post("/store-config", { deletedIds: ids }).catch(() => {});
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
  if (
    patch.featuredCollection &&
    typeof patch.featuredCollection === "object"
  ) {
    const cleanFeat = sanitizeFeaturedCollection(patch.featuredCollection);
    localStorage.setItem(
      "ummo_admin_featured_collection_v1",
      JSON.stringify(cleanFeat)
    );
    window.dispatchEvent(
      new CustomEvent("ummo:featured-collection-updated", { detail: cleanFeat })
    );
  }
  notifyCatalogSubscribers();
  return apiClient.post("/store-config", patch).catch(() => {});
}

export function applyRemoteStoreConfig(val) {
  if (!val || typeof val !== "object") return;
  if (Date.now() - lastLocalConfigWriteAt < 10000) {
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
      if (prevJson !== null) {
        window.dispatchEvent(
          new CustomEvent("ummo:banners-updated", { detail: cleanBanners })
        );
      }
    }
  }
  if (val.featuredCollection && typeof val.featuredCollection === "object") {
    const cleanFeat = sanitizeFeaturedCollection(
      val.featuredCollection,
      val.banners?.dealBanner
    );
    const nextJson = JSON.stringify(cleanFeat);
    const prevJson = localStorage.getItem("ummo_admin_featured_collection_v1");
    if (prevJson !== nextJson) {
      localStorage.setItem("ummo_admin_featured_collection_v1", nextJson);
      window.dispatchEvent(
        new CustomEvent("ummo:featured-collection-updated", {
          detail: cleanFeat,
        })
      );
      catalogChanged = true;
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

export async function validateCouponOnServer(payload) {
  const response = await apiClient.post("/coupons/validate", payload);
  return response.data;
}

let storeConfigSyncPromise = null;

export function initStoreConfigSync(onCatalogChanged) {
  const unsubscribe = subscribeToCatalogChanges(onCatalogChanged);

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

  return unsubscribe;
}
