import { INITIAL_CATALOG_SEED } from "../../src/services/catalogSeed.js";
import { CLOUDINARY_CLOUD_NAME } from "../db.js";
import { asSafeId } from "../security.js";

export const DEFAULT_SITE_URL = "https://fullstack-ummo-eccomerce.vercel.app";

const DEPARTMENT_SLUGS = [
  "women",
  "men",
  "kids",
  "beauty-personal-care",
  "fragrances",
  "electronics-gadgets",
  "home-living",
  "sports-outdoors",
  "groceries-essentials",
];

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getMergedLiveCatalogForSeo(state) {
  const deletedIds = new Set(
    (state?.storeConfig?.deletedIds || []).map((id) => String(id))
  );
  const customProducts = Array.isArray(state?.storeConfig?.customProducts)
    ? state.storeConfig.customProducts
    : [];
  const customMap = new Map(customProducts.map((p) => [String(p.id), p]));
  const baseIdSet = new Set(INITIAL_CATALOG_SEED.map((p) => String(p.id)));
  const featured = state?.storeConfig?.featuredCollection;
  const featuredIds = new Set(
    featured?.enabled !== false && Array.isArray(featured?.productIds)
      ? featured.productIds.map(String)
      : []
  );
  const featuredPct =
    featured?.enabled !== false
      ? Math.min(90, Math.max(0, Number(featured?.discountPercentage || 0)))
      : 0;

  const list = [];

  for (const cp of customProducts) {
    const idStr = String(cp?.id || "");
    if (!idStr || deletedIds.has(idStr) || cp.isVisible === false) continue;
    if (cp.isCustomNew || !baseIdSet.has(idStr)) {
      const pct = Math.max(
        Number(cp.discountPercentage || 0),
        featuredIds.has(idStr) ? featuredPct : 0
      );
      list.push({
        ...cp,
        discountPercentage: pct,
      });
    }
  }

  for (const seed of INITIAL_CATALOG_SEED) {
    const idStr = String(seed.id);
    if (deletedIds.has(idStr)) continue;
    const override = customMap.get(idStr);
    if (override && override.isVisible === false) continue;
    const defaultThumb = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800,c_limit/ummo_products/product_${seed.id}`;
    const merged = {
      ...seed,
      thumbnail: defaultThumb,
      ...(override || {}),
    };
    const pct = Math.max(
      Number(merged.discountPercentage || 0),
      featuredIds.has(idStr) ? featuredPct : 0
    );
    list.push({
      ...merged,
      discountPercentage: pct,
    });
  }

  return list;
}

export function buildDynamicSitemapXml(state, baseUrl = DEFAULT_SITE_URL) {
  const cleanBase = String(baseUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const today = new Date().toISOString().split("T")[0];
  const staticPaths = [
    { path: "/", priority: "1.0", changefreq: "daily" },
    { path: "/shop", priority: "0.9", changefreq: "daily" },
    { path: "/discounts", priority: "0.9", changefreq: "daily" },
    { path: "/featured", priority: "0.9", changefreq: "daily" },
    { path: "/about", priority: "0.6", changefreq: "monthly" },
    { path: "/contact", priority: "0.6", changefreq: "monthly" },
    { path: "/faq", priority: "0.5", changefreq: "monthly" },
    { path: "/blog", priority: "0.6", changefreq: "weekly" },
  ];

  const entries = [];
  for (const s of staticPaths) {
    entries.push(
      `  <url>\n    <loc>${escapeXml(`${cleanBase}${s.path}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${s.changefreq}</changefreq>\n    <priority>${s.priority}</priority>\n  </url>`
    );
  }

  for (const slug of DEPARTMENT_SLUGS) {
    entries.push(
      `  <url>\n    <loc>${escapeXml(`${cleanBase}/category/${slug}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  }

  const products = getMergedLiveCatalogForSeo(state);
  for (const p of products) {
    entries.push(
      `  <url>\n    <loc>${escapeXml(`${cleanBase}/shop/${p.id}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}

export function buildProductBotSeoHtml(
  rawProductId,
  state,
  baseUrl = DEFAULT_SITE_URL
) {
  const cleanBase = String(baseUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const safeId = asSafeId(rawProductId, 64);
  const catalog = getMergedLiveCatalogForSeo(state);
  const product = catalog.find((p) => String(p.id) === String(safeId));

  if (!product) {
    return {
      found: false,
      statusCode: 404,
      html: `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><title>Product Not Found | UOMO</title><meta name="robots" content="noindex"/></head><body><p>Product not found.</p></body></html>`,
    };
  }

  const regularPrice = Math.max(0, Number(product.price || 0));
  const discPct = Math.min(
    90,
    Math.max(0, Number(product.discountPercentage || 0))
  );
  const effectivePrice =
    discPct > 0
      ? Number((regularPrice * (1 - discPct / 100)).toFixed(2))
      : Number(regularPrice.toFixed(2));
  const inStock = Number(product.stock ?? 20) > 0;
  const canonicalUrl = `${cleanBase}/shop/${product.id}`;
  const imageUrl =
    product.thumbnail ||
    (Array.isArray(product.images) && product.images[0]) ||
    `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800,c_limit/ummo_products/product_1`;

  const title = `${product.title} — ${product.brand || "UOMO"} | UOMO`;
  const description = (
    product.description ||
    `Buy ${product.title} at $${effectivePrice.toFixed(2)} from UOMO with fast delivery and authentic quality guarantee.`
  ).slice(0, 260);

  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    image: [imageUrl],
    sku: String(product.sku || `UMMO-${product.id}`),
    brand: {
      "@type": "Brand",
      name: String(product.brand || "UOMO"),
    },
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: "USD",
      price: effectivePrice.toFixed(2),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  });

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="UOMO" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="product:price:amount" content="${effectivePrice.toFixed(2)}" />
    <meta property="product:price:currency" content="USD" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <script type="application/ld+json">${schemaJson}</script>
  </head>
  <body>
    <h1>${escapeHtml(product.title)}</h1>
    <p>${escapeHtml(description)}</p>
    <p>Price: $${effectivePrice.toFixed(2)} USD</p>
    <a href="${escapeHtml(canonicalUrl)}">View Product on UOMO</a>
  </body>
</html>`;

  return {
    found: true,
    statusCode: 200,
    html,
  };
}
