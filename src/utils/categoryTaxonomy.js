/**
 * Canonical Department & Subcategory Taxonomy Engine for UOMO Ecommerce (Gate 5)
 * Deterministically classifies catalog products using actual metadata (department,
 * subcategory, category, tags, title, brand, description) without assigning
 * fake gender categories to non-fashion products.
 */

export const CANONICAL_DEPARTMENTS = [
  {
    slug: "men",
    name: "Men",
    title: "Men's Fashion & Accessories",
    description:
      "Tailored shirts, athletic & casual footwear, luxury timepieces, and classic eyewear crafted for modern men.",
    isPrimaryFashion: true,
    subcategories: ["Clothing", "Shoes", "Accessories", "Watches"],
    legacyCategories: ["mens-shirts", "mens-shoes", "mens-watches"],
  },
  {
    slug: "women",
    name: "Women",
    title: "Women's Fashion & Luxury Collection",
    description:
      "Statement dresses, designer handbags, heels, fine jewellery, watches, and curated beauty essentials.",
    isPrimaryFashion: true,
    subcategories: ["Clothing", "Shoes", "Bags", "Accessories", "Beauty"],
    legacyCategories: [
      "womens-dresses",
      "womens-shoes",
      "womens-bags",
      "womens-jewellery",
      "womens-watches",
    ],
  },
  {
    slug: "kids",
    name: "Kids",
    title: "Kids' & Junior Collection",
    description:
      "Comfortable summer dresses, frocks, junior sportswear, playful accessories, and everyday essentials for boys and girls.",
    isPrimaryFashion: true,
    subcategories: [
      "Boys",
      "Girls",
      "Clothing",
      "Shoes",
      "Toys",
      "Baby Essentials",
    ],
    legacyCategories: ["kids", "kids-clothing", "kids-shoes", "kids-toys"],
  },
  {
    slug: "beauty",
    name: "Beauty & Personal Care",
    title: "Beauty, Cosmetics & Skin Care",
    description:
      "Cruelty-free cosmetics, palettes, lipsticks, nail couture, and nourishing daily skin care.",
    isPrimaryFashion: false,
    subcategories: ["Cosmetics", "Skin Care"],
    legacyCategories: ["beauty", "skin-care"],
  },
  {
    slug: "fragrances",
    name: "Fragrances",
    title: "Luxury Fragrances & Perfumes",
    description:
      "Iconic designer Eau de Parfum and Eau de Toilette fragrances from Chanel, Dior, Gucci, Dolce & Gabbana, and Calvin Klein.",
    isPrimaryFashion: false,
    subcategories: ["Perfumes", "Unisex Scents"],
    legacyCategories: ["fragrances"],
  },
  {
    slug: "electronics",
    name: "Electronics & Gadgets",
    title: "Electronics, Smartphones & Laptops",
    description:
      "Flagship smartphones, ultrabooks, tablets, wireless audio, and smart accessories.",
    isPrimaryFashion: false,
    subcategories: [
      "Smartphones",
      "Laptops",
      "Tablets",
      "Mobile Accessories",
    ],
    legacyCategories: [
      "smartphones",
      "laptops",
      "tablets",
      "mobile-accessories",
    ],
  },
  {
    slug: "home-living",
    name: "Home & Living",
    title: "Home, Furniture & Kitchen Essentials",
    description:
      "Designer furniture, artisan home decor, and modern kitchen tools & appliances.",
    isPrimaryFashion: false,
    subcategories: ["Furniture", "Home Decoration", "Kitchen Accessories"],
    legacyCategories: ["furniture", "home-decoration", "kitchen-accessories"],
  },
  {
    slug: "sports",
    name: "Sports & Outdoors",
    title: "Sports, Fitness & Outdoor Gear",
    description:
      "Athletic training equipment, cricket, football, tennis, golf gear, and outdoor motorsports.",
    isPrimaryFashion: false,
    subcategories: ["Team Sports", "Fitness & Training", "Motorsports & Vehicles"],
    legacyCategories: ["sports-accessories", "motorcycle", "vehicle"],
  },
  {
    slug: "groceries",
    name: "Groceries & Essentials",
    title: "Groceries & Daily Household Essentials",
    description:
      "Fresh produce, pantry staples, beverages, cooking essentials, and pet nutrition.",
    isPrimaryFashion: false,
    subcategories: [
      "Fresh Produce",
      "Pantry & Cooking",
      "Meat & Seafood",
      "Beverages & Dairy",
      "Pet Supplies",
    ],
    legacyCategories: ["groceries"],
  },
  {
    slug: "uncategorized",
    name: "Uncategorized / Needs Review",
    title: "Uncategorized Products Queue",
    description: "Products awaiting administrator category verification.",
    isPrimaryFashion: false,
    isAdminOnly: true,
    subcategories: ["Needs Review"],
    legacyCategories: [],
  },
];

const CUSTOM_TAXONOMY_STORAGE_KEY = "ummo_admin_custom_taxonomy_v1";

export function getCustomTaxonomyOverrides() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(CUSTOM_TAXONOMY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { customDepartments: [], productMappings: {} };
}

export function saveCustomTaxonomyOverrides(nextOverrides) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        CUSTOM_TAXONOMY_STORAGE_KEY,
        JSON.stringify(nextOverrides)
      );
      window.dispatchEvent(
        new CustomEvent("ummo:taxonomy-updated", { detail: nextOverrides })
      );
    }
  } catch {
    // ignore
  }
}

export function getAllDepartments(includeAdminOnly = false) {
  const overrides = getCustomTaxonomyOverrides();
  const customDepts = Array.isArray(overrides.customDepartments)
    ? overrides.customDepartments
    : [];
  const merged = [...CANONICAL_DEPARTMENTS];
  for (const cd of customDepts) {
    if (cd?.slug && !merged.some((d) => d.slug === cd.slug)) {
      merged.push({
        slug: String(cd.slug).toLowerCase(),
        name: cd.name || cd.slug,
        title: cd.title || cd.name || cd.slug,
        description: cd.description || "",
        isPrimaryFashion: Boolean(cd.isPrimaryFashion),
        subcategories: Array.isArray(cd.subcategories)
          ? cd.subcategories
          : ["General"],
        legacyCategories: [],
      });
    }
  }
  return includeAdminOnly ? merged : merged.filter((d) => !d.isAdminOnly);
}

export function getDepartmentBySlug(slug) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) return null;
  const all = getAllDepartments(true);
  return (
    all.find((d) => d.slug === normalized) ||
    all.find((d) => (d.legacyCategories || []).includes(normalized)) ||
    null
  );
}

/**
 * Deterministically classifies a product into { department, departmentName, subcategory, secondaryDepartments, needsReview, reviewReason }.
 */
export function classifyProductTaxonomy(product) {
  if (!product || typeof product !== "object") {
    return {
      department: "uncategorized",
      departmentName: "Uncategorized / Needs Review",
      subcategory: "Needs Review",
      secondaryDepartments: [],
      needsReview: true,
      reviewReason: "Missing product metadata",
    };
  }

  // 1. Check explicit Admin taxonomy override on product or in local mapping table
  const overrides = getCustomTaxonomyOverrides();
  const mappedOverride = overrides.productMappings?.[String(product.id)];
  const explicitDept = String(
    mappedOverride?.department || product.department || ""
  )
    .trim()
    .toLowerCase();
  const explicitSub = String(
    mappedOverride?.subcategory || product.subcategory || ""
  ).trim();

  if (explicitDept) {
    const deptObj = getDepartmentBySlug(explicitDept);
    if (deptObj) {
      return {
        department: deptObj.slug,
        departmentName: deptObj.name,
        subcategory:
          explicitSub || deptObj.subcategories?.[0] || "General",
        secondaryDepartments: [],
        needsReview: false,
        reviewReason: "",
      };
    }
  }

  const rawCategory = String(product.category || "")
    .trim()
    .toLowerCase();
  const title = String(product.title || "").toLowerCase();
  const description = String(product.description || "").toLowerCase();
  const tags = Array.isArray(product.tags)
    ? product.tags.map((t) => String(t).toLowerCase())
    : [];
  const combinedText = `${title} ${ tags.join(" ") } ${description}`;

  // 2. Kids' Collection deterministic detection (from explicit kids category or unmistakable kids/girls frock metadata)
  if (
    rawCategory.startsWith("kids") ||
    tags.some((t) => t.includes("girls'") || t.includes("boys'") || t.includes("kids")) ||
    /\b(girl summer dress|blue frock|short frock|kids|toddler|infant|baby)\b/i.test(
      title
    )
  ) {
    let sub = "Clothing";
    if (title.includes("girl") || title.includes("frock") || tags.some((t) => t.includes("girl"))) {
      sub = "Girls";
    } else if (title.includes("boy") || tags.some((t) => t.includes("boy"))) {
      sub = "Boys";
    } else if (title.includes("shoe") || title.includes("sneaker")) {
      sub = "Shoes";
    } else if (title.includes("toy")) {
      sub = "Toys";
    } else if (title.includes("baby") || title.includes("infant")) {
      sub = "Baby Essentials";
    }
    return {
      department: "kids",
      departmentName: "Kids",
      subcategory: sub,
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }

  // 3. Men's Fashion
  if (rawCategory === "mens-shirts" || rawCategory === "men-clothing") {
    return {
      department: "men",
      departmentName: "Men",
      subcategory: "Clothing",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }
  if (rawCategory === "mens-shoes") {
    return {
      department: "men",
      departmentName: "Men",
      subcategory: "Shoes",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }
  if (rawCategory === "mens-watches") {
    return {
      department: "men",
      departmentName: "Men",
      subcategory: "Watches",
      secondaryDepartments: ["Accessories"],
      needsReview: false,
      reviewReason: "",
    };
  }

  // 4. Women's Fashion
  if (rawCategory === "womens-dresses" || rawCategory === "tops") {
    return {
      department: "women",
      departmentName: "Women",
      subcategory: "Clothing",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }
  if (rawCategory === "womens-shoes") {
    return {
      department: "women",
      departmentName: "Women",
      subcategory: "Shoes",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }
  if (rawCategory === "womens-bags") {
    return {
      department: "women",
      departmentName: "Women",
      subcategory: "Bags",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }
  if (rawCategory === "womens-jewellery" || rawCategory === "womens-watches") {
    return {
      department: "women",
      departmentName: "Women",
      subcategory: "Accessories",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }

  // 5. Sunglasses (Fashion Eyewear Accessories - Unisex unless specified)
  if (rawCategory === "sunglasses") {
    const isWomensStyle =
      title.includes("party") || title.includes("green and black");
    return {
      department: isWomensStyle ? "women" : "men",
      departmentName: isWomensStyle ? "Women" : "Men",
      subcategory: "Accessories",
      secondaryDepartments: [isWomensStyle ? "men" : "women"],
      needsReview: true,
      reviewReason:
        "Unisex eyewear ('sunglasses') mapped to Accessories; Admin can confirm primary gender department.",
    };
  }

  // 6. Beauty & Personal Care (Also linked as secondary under Women > Beauty)
  if (rawCategory === "beauty" || rawCategory === "skin-care") {
    return {
      department: "beauty",
      departmentName: "Beauty & Personal Care",
      subcategory: rawCategory === "skin-care" ? "Skin Care" : "Cosmetics",
      secondaryDepartments: ["women"],
      secondarySubcategory: "Beauty",
      needsReview: false,
      reviewReason: "",
    };
  }

  // 7. Fragrances
  if (rawCategory === "fragrances") {
    const isUnisex = combinedText.includes("unisex");
    return {
      department: "fragrances",
      departmentName: "Fragrances",
      subcategory: isUnisex ? "Unisex Scents" : "Perfumes",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }

  // 8. Electronics & Gadgets
  if (
    ["smartphones", "laptops", "tablets", "mobile-accessories"].includes(
      rawCategory
    )
  ) {
    const subMap = {
      smartphones: "Smartphones",
      laptops: "Laptops",
      tablets: "Tablets",
      "mobile-accessories": "Mobile Accessories",
    };
    return {
      department: "electronics",
      departmentName: "Electronics & Gadgets",
      subcategory: subMap[rawCategory] || "Gadgets",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }

  // 9. Home & Living
  if (
    ["furniture", "home-decoration", "kitchen-accessories"].includes(
      rawCategory
    )
  ) {
    const subMap = {
      furniture: "Furniture",
      "home-decoration": "Home Decoration",
      "kitchen-accessories": "Kitchen Accessories",
    };
    return {
      department: "home-living",
      departmentName: "Home & Living",
      subcategory: subMap[rawCategory] || "Home Essentials",
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }

  // 10. Sports & Outdoors
  if (["sports-accessories", "motorcycle", "vehicle"].includes(rawCategory)) {
    let sub = "Team Sports";
    if (rawCategory === "motorcycle" || rawCategory === "vehicle") {
      sub = "Motorsports & Vehicles";
    } else if (
      title.includes("dumbbell") ||
      title.includes("jump rope") ||
      title.includes("mat")
    ) {
      sub = "Fitness & Training";
    }
    return {
      department: "sports",
      departmentName: "Sports & Outdoors",
      subcategory: sub,
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }

  // 11. Groceries & Essentials
  if (rawCategory === "groceries") {
    let sub = "Pantry & Cooking";
    if (
      title.includes("cat food") ||
      title.includes("dog food") ||
      tags.includes("pet supplies")
    ) {
      sub = "Pet Supplies";
    } else if (
      title.includes("steak") ||
      title.includes("meat") ||
      title.includes("fish") ||
      title.includes("chicken")
    ) {
      sub = "Meat & Seafood";
    } else if (
      title.includes("juice") ||
      title.includes("milk") ||
      title.includes("water") ||
      title.includes("coffee") ||
      title.includes("soft drinks") ||
      title.includes("ice cream")
    ) {
      sub = "Beverages & Dairy";
    } else if (
      title.includes("apple") ||
      title.includes("cucumber") ||
      title.includes("lemon") ||
      title.includes("kiwi") ||
      title.includes("strawberry") ||
      title.includes("mulberry") ||
      title.includes("potato") ||
      title.includes("onion") ||
      title.includes("pepper")
    ) {
      sub = "Fresh Produce";
    }
    return {
      department: "groceries",
      departmentName: "Groceries & Essentials",
      subcategory: sub,
      secondaryDepartments: [],
      needsReview: false,
      reviewReason: "",
    };
  }

  // 12. Fallback -> Uncategorized / Needs Review
  return {
    department: "uncategorized",
    departmentName: "Uncategorized / Needs Review",
    subcategory: "Needs Review",
    secondaryDepartments: [],
    needsReview: true,
    reviewReason: `Unrecognized category "${rawCategory || "none"}" requires Admin classification.`,
  };
}

/**
 * Checks whether a product belongs to a requested department slug and optional subcategory.
 */
export function matchesDepartmentFilter(product, departmentSlug, subcategory = "all") {
  if (!departmentSlug || departmentSlug === "all") return true;
  const slug = String(departmentSlug).trim().toLowerCase();
  const tax = classifyProductTaxonomy(product);
  const rawCat = String(product?.category || "").trim().toLowerCase();

  // Direct legacy category match (e.g., "womens-dresses", "mens-shoes")
  if (rawCat === slug) {
    return true;
  }

  const isPrimaryMatch = tax.department === slug;
  const isSecondaryMatch =
    Array.isArray(tax.secondaryDepartments) &&
    tax.secondaryDepartments.includes(slug);

  if (!isPrimaryMatch && !isSecondaryMatch) {
    return false;
  }

  if (!subcategory || subcategory === "all") {
    return true;
  }

  const subNorm = String(subcategory).trim().toLowerCase();
  if (isPrimaryMatch && String(tax.subcategory).toLowerCase() === subNorm) {
    return true;
  }
  if (
    isSecondaryMatch &&
    String(tax.secondarySubcategory || tax.subcategory).toLowerCase() === subNorm
  ) {
    return true;
  }
  return false;
}

/**
 * Computes summary counts per department and subcategory for an array of products.
 */
export function summarizeCatalogTaxonomy(products = []) {
  const departments = getAllDepartments(true);
  const summaryMap = {};

  for (const dept of departments) {
    summaryMap[dept.slug] = {
      ...dept,
      totalCount: 0,
      discountedCount: 0,
      subcategoryCounts: Object.fromEntries(
        (dept.subcategories || []).map((s) => [s, 0])
      ),
    };
  }

  const reviewQueue = [];

  for (const item of products) {
    if (!item || item.isVisible === false || item.status === "draft") continue;
    const tax = classifyProductTaxonomy(item);
    const bucket = summaryMap[tax.department] || summaryMap.uncategorized;
    if (bucket) {
      bucket.totalCount += 1;
      if (Number(item.discountPercentage || 0) > 0) {
        bucket.discountedCount += 1;
      }
      if (tax.subcategory) {
        bucket.subcategoryCounts[tax.subcategory] =
          (bucket.subcategoryCounts[tax.subcategory] || 0) + 1;
      }
    }
    if (tax.needsReview) {
      reviewQueue.push({
        product: item,
        taxonomy: tax,
      });
    }
  }

  return {
    departments: Object.values(summaryMap),
    reviewQueue,
  };
}
