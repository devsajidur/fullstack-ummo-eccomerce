import { getCloudinaryBannerUrl } from "../cloudinary";

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

export const DEFAULT_FEATURED_COLLECTION = {
  enabled: true,
  tag: "DEAL OF THE WEEK",
  titleBold: "Spring",
  titleRegular: "Collection",
  description:
    "Explore curated seasonal essentials with verified markdowns across Women, Men, and Lifestyle collections.",
  ctaText: "SHOP NOW",
  ctaLink: "/featured",
  bgColor: "#ebebeb",
  image: "",
  timerEnabled: true,
  countdownDate: "2026-12-31T23:59:59.000Z",
  discountPercentage: 20,
  productIds: [177, 178, 181, 174, 83, 88, 93, 8],
};

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
    ctaLink: "/featured",
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

function normalizeCtaLabel(rawCta) {
  const trimmed = String(rawCta || "").trim();
  if (!trimmed || trimmed.toUpperCase() === "NOW") {
    return "SHOP NOW";
  }
  return trimmed;
}

export function sanitizeBanners(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_BANNERS;
  const merged = { ...DEFAULT_BANNERS, ...raw };
  if (merged.dealBanner && typeof merged.dealBanner === "object") {
    merged.dealBanner = {
      ...DEFAULT_BANNERS.dealBanner,
      ...merged.dealBanner,
      ctaText: normalizeCtaLabel(merged.dealBanner.ctaText),
    };
  }
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

export function sanitizeFeaturedCollection(raw, fallbackDealBanner = null) {
  const deal =
    fallbackDealBanner && typeof fallbackDealBanner === "object"
      ? fallbackDealBanner
      : {};
  const src = raw && typeof raw === "object" ? raw : {};

  const hasExplicitIds = Array.isArray(src.productIds);
  const rawIds = hasExplicitIds
    ? src.productIds
    : DEFAULT_FEATURED_COLLECTION.productIds;
  const seenIds = new Set();
  const cleanIds = [];
  for (const id of rawIds) {
    const key = String(id ?? "").trim();
    if (!key || seenIds.has(key)) continue;
    seenIds.add(key);
    const asNum = Number(key);
    cleanIds.push(Number.isInteger(asNum) && String(asNum) === key ? asNum : key);
  }

  const rawDiscount =
    src.discountPercentage !== undefined
      ? Number(src.discountPercentage)
      : DEFAULT_FEATURED_COLLECTION.discountPercentage;
  const discountPercentage = Number.isFinite(rawDiscount)
    ? Math.min(90, Math.max(0, Math.round(rawDiscount)))
    : DEFAULT_FEATURED_COLLECTION.discountPercentage;

  return {
    enabled: src.enabled !== false,
    tag:
      String(src.tag ?? deal.tag ?? DEFAULT_FEATURED_COLLECTION.tag).trim() ||
      DEFAULT_FEATURED_COLLECTION.tag,
    titleBold:
      String(
        src.titleBold ?? deal.titleBold ?? DEFAULT_FEATURED_COLLECTION.titleBold
      ).trim() || DEFAULT_FEATURED_COLLECTION.titleBold,
    titleRegular:
      String(
        src.titleRegular ??
          deal.titleRegular ??
          DEFAULT_FEATURED_COLLECTION.titleRegular
      ).trim() || DEFAULT_FEATURED_COLLECTION.titleRegular,
    description:
      String(
        src.description ?? DEFAULT_FEATURED_COLLECTION.description
      ).trim() || DEFAULT_FEATURED_COLLECTION.description,
    ctaText: normalizeCtaLabel(src.ctaText ?? deal.ctaText),
    ctaLink: "/featured",
    bgColor:
      String(
        src.bgColor ?? deal.bgColor ?? DEFAULT_FEATURED_COLLECTION.bgColor
      ).trim() || "#ebebeb",
    image: String(src.image ?? deal.image ?? "").trim(),
    timerEnabled: src.timerEnabled !== false,
    countdownDate:
      src.countdownDate !== undefined
        ? String(src.countdownDate || "").trim()
        : String(
            deal.countdownDate ?? DEFAULT_FEATURED_COLLECTION.countdownDate
          ).trim(),
    discountPercentage,
    productIds: cleanIds,
  };
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
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("ummo_admin_coupons", JSON.stringify(DEFAULT_COUPONS));
  }
  return DEFAULT_COUPONS;
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

export function getStoredFeaturedCollection() {
  const dealFallback = getStoredBanners()?.dealBanner || null;
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("ummo_admin_featured_collection_v1");
      if (saved) {
        return sanitizeFeaturedCollection(JSON.parse(saved), dealFallback);
      }
    }
  } catch {
    // ignore
  }
  return sanitizeFeaturedCollection(null, dealFallback);
}

export function getCustomAdminProducts() {
  try {
    const saved = localStorage.getItem("ummo_admin_custom_products");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function getDeletedProductIds() {
  try {
    const saved = localStorage.getItem("ummo_admin_deleted_ids");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

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
