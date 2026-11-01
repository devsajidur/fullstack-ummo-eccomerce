import { getCloudinaryProductImageUrl } from "../cloudinary";
import { INITIAL_CATALOG_SEED } from "../catalogSeed";
import { classifyProductTaxonomy } from "../../utils/categoryTaxonomy";
import {
  getCustomAdminProducts,
  getDeletedProductIds,
  getStoredDiscountCampaigns,
  getStoredFeaturedCollection,
} from "./storeDefaults";

let cachedBaseProducts = null;
let cachedMergedCatalog = null;
let cachedMergedCatalogKey = null;

const catalogSubscribers = new Set();

function getCatalogCacheKey() {
  try {
    if (typeof localStorage === "undefined") return "ssr";
    const cp = localStorage.getItem("ummo_admin_custom_products") || "";
    const del = localStorage.getItem("ummo_admin_deleted_ids") || "";
    const camp = localStorage.getItem("ummo_admin_discount_campaigns") || "";
    const tax = localStorage.getItem("ummo_admin_custom_taxonomy_v1") || "";
    const feat = localStorage.getItem("ummo_admin_featured_collection_v1") || "";
    return `${cp.length}:${del.length}:${camp.length}:${tax.length}:${feat.length}:${cp.slice(0, 64)}:${camp.slice(0, 64)}:${feat.slice(0, 64)}`;
  } catch {
    return "default";
  }
}

export function invalidateCatalogCache() {
  cachedBaseProducts = null;
  cachedMergedCatalog = null;
  cachedMergedCatalogKey = null;
}

export function subscribeToCatalogChanges(cb) {
  if (typeof cb === "function") {
    catalogSubscribers.add(cb);
  }
  return () => {
    if (typeof cb === "function") {
      catalogSubscribers.delete(cb);
    }
  };
}

export function notifyCatalogSubscribers() {
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
    } else if (val >= bestPct && val > 0) {
      bestPct = val;
      bestFixed = 0;
      bestEndTime = camp.endTime || bestEndTime;
      bestStartTime = camp.startTime || bestStartTime;
      appliedCampaignName = camp.name || appliedCampaignName;
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
  const storedCampaigns = getStoredDiscountCampaigns();
  const featuredConfig = getStoredFeaturedCollection();
  const featuredIdSet = new Set(
    Array.isArray(featuredConfig?.productIds)
      ? featuredConfig.productIds.map(String)
      : []
  );

  const campaigns = [...storedCampaigns];
  if (
    featuredConfig &&
    featuredConfig.enabled !== false &&
    featuredIdSet.size > 0 &&
    Number(featuredConfig.discountPercentage) > 0
  ) {
    campaigns.push({
      id: "CAMP-FEATURED-COLLECTION",
      name: `${featuredConfig.titleBold || "Featured"} ${
        featuredConfig.titleRegular || "Collection"
      }`.trim(),
      type: "percentage",
      value: Number(featuredConfig.discountPercentage),
      scope: "products",
      productIds: Array.from(featuredIdSet),
      startTime: "",
      endTime:
        featuredConfig.timerEnabled !== false && featuredConfig.countdownDate
          ? featuredConfig.countdownDate
          : "",
      active: true,
    });
  }

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
            isFeaturedCollectionItem: featuredIdSet.has(cpId),
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
      isFeaturedCollectionItem: featuredIdSet.has(idStr),
    };

    if (customMap.has(idStr)) {
      const adminOverride = customMap.get(idStr);
      const combined = {
        ...enrichedBase,
        ...adminOverride,
        isFeaturedCollectionItem: featuredIdSet.has(idStr),
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

export async function fetchCatalogProducts(limit = 200) {
  const full = getInitialCatalogSnapshot();
  return limit >= full.length ? full : full.slice(0, limit);
}
