import { classifyProductTaxonomy } from "./categoryTaxonomy.js";

export const COLOR_PALETTE_PRESETS = [
  { name: "Black", hex: "#1F2937" },
  { name: "White", hex: "#F9FAFB" },
  { name: "Ivory", hex: "#FFFFF0" },
  { name: "Sand", hex: "#D8C3A5" },
  { name: "Beige", hex: "#E5D3B3" },
  { name: "Tan", hex: "#C68B59" },
  { name: "Cognac", hex: "#9A463D" },
  { name: "Brown", hex: "#5C4033" },
  { name: "Espresso", hex: "#3B2F2F" },
  { name: "Walnut", hex: "#6E473B" },
  { name: "Oak", hex: "#C89F70" },
  { name: "Charcoal", hex: "#374151" },
  { name: "Silver", hex: "#C0C5CE" },
  { name: "Titanium", hex: "#8A8D8F" },
  { name: "Space Black", hex: "#18181B" },
  { name: "Navy", hex: "#1B365D" },
  { name: "Royal Blue", hex: "#2563EB" },
  { name: "Sky Blue", hex: "#7DD3FC" },
  { name: "Olive", hex: "#556B2F" },
  { name: "Emerald", hex: "#047857" },
  { name: "Sage", hex: "#9CAF88" },
  { name: "Red", hex: "#DC2626" },
  { name: "Ruby Red", hex: "#9B111E" },
  { name: "Burgundy", hex: "#722F37" },
  { name: "Rose Nude", hex: "#C98A82" },
  { name: "Blush Pink", hex: "#F4B6C2" },
  { name: "Berry Plum", hex: "#702963" },
  { name: "Gold", hex: "#D4AF37" },
  { name: "Rose Gold", hex: "#B76E79" },
  { name: "Mustard", hex: "#D97706" },
];

const COLOR_LOOKUP = new Map(
  COLOR_PALETTE_PRESETS.map((c) => [c.name.toLowerCase(), c.hex])
);
COLOR_LOOKUP.set("jet black", "#111111");
COLOR_LOOKUP.set("gray", "#6B7280");
COLOR_LOOKUP.set("grey", "#6B7280");
COLOR_LOOKUP.set("cream", "#FFFDD0");
COLOR_LOOKUP.set("nude", "#E3BC9A");
COLOR_LOOKUP.set("camel", "#C19A6B");
COLOR_LOOKUP.set("khaki", "#C3B091");
COLOR_LOOKUP.set("blue", "#1D4ED8");
COLOR_LOOKUP.set("denim", "#2B4C7E");
COLOR_LOOKUP.set("teal", "#0D9488");
COLOR_LOOKUP.set("green", "#15803D");
COLOR_LOOKUP.set("pink", "#EC4899");
COLOR_LOOKUP.set("rose", "#E11D48");
COLOR_LOOKUP.set("coral", "#F97316");
COLOR_LOOKUP.set("orange", "#EA580C");
COLOR_LOOKUP.set("yellow", "#EAB308");
COLOR_LOOKUP.set("purple", "#7E22CE");
COLOR_LOOKUP.set("lavender", "#C4B5FD");
COLOR_LOOKUP.set("wine", "#722F37");
COLOR_LOOKUP.set("crimson", "#B91C1C");
COLOR_LOOKUP.set("warm sand", "#D6B588");
COLOR_LOOKUP.set("honey", "#BA8759");
COLOR_LOOKUP.set("tortoise brown", "#5B3A29");

export const SIZE_PRESET_GROUPS = [
  {
    id: "apparel",
    label: "Apparel (XS–XXL)",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    id: "kids",
    label: "Kids (2Y–10Y)",
    sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-11Y"],
  },
  {
    id: "shoes-men",
    label: "Shoes EU (39–44)",
    sizes: ["EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44"],
  },
  {
    id: "shoes-women",
    label: "Shoes EU (36–41)",
    sizes: ["EU 36", "EU 37", "EU 38", "EU 39", "EU 40", "EU 41"],
  },
  {
    id: "fragrance",
    label: "Volume (30–100ml)",
    sizes: ["30ml", "50ml", "100ml"],
  },
  {
    id: "storage",
    label: "Storage (128–512GB)",
    sizes: ["128GB", "256GB", "512GB"],
  },
  {
    id: "none",
    label: "No Sizes",
    sizes: [],
  },
];

function fallbackHexForName(name) {
  let hash = 0;
  const str = String(name || "Color");
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const r = 60 + (Math.abs(hash) % 140);
  const g = 60 + (Math.abs(hash >> 8) % 140);
  const b = 60 + (Math.abs(hash >> 16) % 140);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeColorOption(entry) {
  if (!entry) return null;
  if (typeof entry === "object") {
    const cleanName = String(entry.name || entry.label || "").trim();
    if (!cleanName) return null;
    const rawHex = String(entry.hex || entry.color || "").trim();
    const validHex = /^#[0-9a-fA-F]{3,8}$/.test(rawHex)
      ? rawHex
      : COLOR_LOOKUP.get(cleanName.toLowerCase()) ||
        fallbackHexForName(cleanName);
    return { name: cleanName, hex: validHex };
  }

  const raw = String(entry).trim();
  if (!raw) return null;
  if (raw.includes(":")) {
    const [namePart, hexPart] = raw.split(":");
    const cleanName = String(namePart || "").trim();
    const cleanHex = String(hexPart || "").trim();
    if (!cleanName) return null;
    return {
      name: cleanName,
      hex: /^#[0-9a-fA-F]{3,8}$/.test(cleanHex)
        ? cleanHex
        : COLOR_LOOKUP.get(cleanName.toLowerCase()) ||
          fallbackHexForName(cleanName),
    };
  }

  return {
    name: raw,
    hex: COLOR_LOOKUP.get(raw.toLowerCase()) || fallbackHexForName(raw),
  };
}

export function normalizeColorList(rawColors) {
  if (!Array.isArray(rawColors)) return [];
  const seen = new Set();
  const out = [];
  for (const item of rawColors) {
    const norm = normalizeColorOption(item);
    if (!norm) continue;
    const key = norm.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}

export function normalizeSizeList(rawSizes) {
  if (!Array.isArray(rawSizes)) return [];
  const seen = new Set();
  const out = [];
  for (const s of rawSizes) {
    const clean = String(s || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

/**
 * Infers realistic, category-appropriate sizes & colors for products that do not
 * have explicit custom variants configured by an Administrator.
 */
export function getCategoryDefaultVariants(product) {
  if (!product || typeof product !== "object") {
    return {
      sizes: [],
      colors: [],
      sizeLabel: "Size",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  const tax = classifyProductTaxonomy(product);
  const dept = String(product.department || tax.department || "").toLowerCase();
  const sub = String(product.subcategory || tax.subcategory || "").toLowerCase();
  const cat = String(product.category || "").toLowerCase();
  const title = String(product.title || "").toLowerCase();

  // 1. Groceries & Food Essentials -> No sizes, no colors
  if (dept === "groceries" || cat === "groceries") {
    return {
      sizes: [],
      colors: [],
      sizeLabel: "Size",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  // 2. Fragrances & Perfumes -> Bottle volumes, no shirt colors
  if (dept === "fragrances" || cat === "fragrances") {
    return {
      sizes: ["50ml", "100ml"],
      colors: [],
      sizeLabel: "Bottle Size",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  // 3. Beauty, Cosmetics & Skin Care
  if (dept === "beauty" || cat === "beauty" || cat === "skin-care") {
    if (cat === "skin-care" || sub.includes("skin")) {
      return {
        sizes: ["100ml", "200ml"],
        colors: [],
        sizeLabel: "Volume",
        colorLabel: "Shade",
        showSizeGuide: false,
      };
    }
    if (title.includes("lipstick") || title.includes("nail")) {
      return {
        sizes: [],
        colors: normalizeColorList(["Ruby Red", "Rose Nude", "Berry Plum"]),
        sizeLabel: "Size",
        colorLabel: "Shade",
        showSizeGuide: false,
      };
    }
    if (title.includes("powder") || title.includes("foundation")) {
      return {
        sizes: [],
        colors: normalizeColorList(["Ivory", "Warm Sand", "Honey"]),
        sizeLabel: "Size",
        colorLabel: "Shade",
        showSizeGuide: false,
      };
    }
    return {
      sizes: [],
      colors: normalizeColorList(["Jet Black", "Espresso"]),
      sizeLabel: "Size",
      colorLabel: "Shade",
      showSizeGuide: false,
    };
  }

  // 4. Footwear (Men's, Women's, Kids' Shoes)
  if (
    cat === "mens-shoes" ||
    cat === "womens-shoes" ||
    cat === "kids-shoes" ||
    sub === "shoes"
  ) {
    if (dept === "women" || cat === "womens-shoes") {
      return {
        sizes: ["EU 36", "EU 37", "EU 38", "EU 39", "EU 40"],
        colors: normalizeColorList(["Black", "Beige", "Burgundy"]),
        sizeLabel: "Shoe Size",
        colorLabel: "Color",
        showSizeGuide: false,
      };
    }
    if (dept === "kids" || cat === "kids-shoes") {
      return {
        sizes: ["EU 28", "EU 30", "EU 32", "EU 34"],
        colors: normalizeColorList(["White", "Navy", "Red"]),
        sizeLabel: "Shoe Size",
        colorLabel: "Color",
        showSizeGuide: false,
      };
    }
    return {
      sizes: ["EU 40", "EU 41", "EU 42", "EU 43", "EU 44"],
      colors: normalizeColorList(["Black", "White", "Tan"]),
      sizeLabel: "Shoe Size",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  // 5. Handbags & Bags
  if (cat === "womens-bags" || sub === "bags") {
    return {
      sizes: [],
      colors: normalizeColorList(["Black", "Tan", "Cognac", "Ivory"]),
      sizeLabel: "Size",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  // 6. Watches, Jewellery & Sunglasses
  if (
    cat === "mens-watches" ||
    cat === "womens-watches" ||
    sub === "watches"
  ) {
    return {
      sizes: ["38mm", "42mm"],
      colors: normalizeColorList(["Silver", "Gold", "Black"]),
      sizeLabel: "Case Size",
      colorLabel: "Finish",
      showSizeGuide: false,
    };
  }
  if (cat === "womens-jewellery") {
    return {
      sizes: [],
      colors: normalizeColorList(["Gold", "Silver", "Rose Gold"]),
      sizeLabel: "Size",
      colorLabel: "Finish",
      showSizeGuide: false,
    };
  }
  if (cat === "sunglasses") {
    return {
      sizes: [],
      colors: normalizeColorList(["Black", "Tortoise Brown", "Gold"]),
      sizeLabel: "Size",
      colorLabel: "Frame",
      showSizeGuide: false,
    };
  }

  // 7. Electronics & Gadgets
  if (
    dept === "electronics" ||
    ["smartphones", "laptops", "tablets", "mobile-accessories"].includes(cat)
  ) {
    if (cat === "smartphones" || cat === "tablets" || sub === "smartphones" || sub === "tablets") {
      return {
        sizes: ["128GB", "256GB"],
        colors: normalizeColorList(["Space Black", "Silver", "Titanium"]),
        sizeLabel: "Storage",
        colorLabel: "Finish",
        showSizeGuide: false,
      };
    }
    if (cat === "laptops" || sub === "laptops") {
      return {
        sizes: ["256GB SSD", "512GB SSD"],
        colors: normalizeColorList(["Space Black", "Silver"]),
        sizeLabel: "Storage",
        colorLabel: "Finish",
        showSizeGuide: false,
      };
    }
    return {
      sizes: [],
      colors: normalizeColorList(["Black", "White"]),
      sizeLabel: "Option",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  // 8. Home, Furniture & Kitchen
  if (
    dept === "home-living" ||
    ["furniture", "home-decoration", "kitchen-accessories"].includes(cat)
  ) {
    if (cat === "furniture" || sub === "furniture") {
      return {
        sizes: [],
        colors: normalizeColorList(["Walnut", "Oak", "Charcoal", "Ivory"]),
        sizeLabel: "Size",
        colorLabel: "Finish",
        showSizeGuide: false,
      };
    }
    return {
      sizes: [],
      colors: [],
      sizeLabel: "Size",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  // 9. Sports, Outdoors & Vehicles
  if (
    dept === "sports" ||
    ["sports-accessories", "motorcycle", "vehicle"].includes(cat)
  ) {
    if (cat === "motorcycle" || cat === "vehicle" || sub.includes("vehicle")) {
      return {
        sizes: [],
        colors: normalizeColorList(["Jet Black", "Crimson", "Silver"]),
        sizeLabel: "Option",
        colorLabel: "Exterior",
        showSizeGuide: false,
      };
    }
    return {
      sizes: [],
      colors: [],
      sizeLabel: "Size",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  // 10. Kids Fashion
  if (dept === "kids") {
    if (sub === "toys" || sub.includes("baby")) {
      return {
        sizes: [],
        colors: normalizeColorList(["Sky Blue", "Blush Pink", "Yellow"]),
        sizeLabel: "Size",
        colorLabel: "Color",
        showSizeGuide: false,
      };
    }
    return {
      sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"],
      colors: normalizeColorList(["Sky Blue", "Blush Pink", "White", "Navy"]),
      sizeLabel: "Age / Size",
      colorLabel: "Color",
      showSizeGuide: false,
    };
  }

  // 11. Default Men's / Women's Apparel & Clothing
  return {
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: normalizeColorList(["Black", "Ivory", "Navy", "Olive"]),
    sizeLabel: "Size",
    colorLabel: "Color",
    showSizeGuide: true,
  };
}

/**
 * Resolves the authoritative sizes & colors for a product on the Single Product page
 * and inside Admin editors. Respects Admin-saved variants (including empty arrays when
 * Admin intentionally disables sizes or colors via hasCustomVariants).
 */
export function resolveProductVariants(product) {
  const defaults = getCategoryDefaultVariants(product);
  if (!product || typeof product !== "object") return defaults;

  const hasExplicitSizes = Array.isArray(product.sizes);
  const hasExplicitColors = Array.isArray(product.colors);

  let sizes = defaults.sizes;
  if (product.hasCustomVariants && hasExplicitSizes) {
    sizes = normalizeSizeList(product.sizes);
  } else if (hasExplicitSizes && product.sizes.length > 0) {
    sizes = normalizeSizeList(product.sizes);
  }

  let colors = defaults.colors;
  if (product.hasCustomVariants && hasExplicitColors) {
    colors = normalizeColorList(product.colors);
  } else if (hasExplicitColors && product.colors.length > 0) {
    colors = normalizeColorList(product.colors);
  }

  const hasApparelSizes = sizes.some((s) =>
    ["XS", "S", "M", "L", "XL", "XXL"].includes(s.toUpperCase())
  );

  return {
    sizes,
    colors,
    sizeLabel: defaults.sizeLabel || "Size",
    colorLabel: defaults.colorLabel || "Color",
    showSizeGuide: defaults.showSizeGuide || hasApparelSizes,
  };
}
