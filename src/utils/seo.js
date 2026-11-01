import { useEffect } from "react";

export const SITE_BASE_URL = "https://fullstack-ummo-eccomerce.vercel.app";
const DEFAULT_TITLE = "UOMO — International Fashion & Lifestyle Storefront";
const DEFAULT_DESCRIPTION =
  "UOMO International Fashion & Lifestyle Storefront — Shop curated women's, men's, kids', beauty, electronics, and luxury essentials with fast delivery and secure checkout.";
const DEFAULT_IMAGE =
  "https://res.cloudinary.com/wxjt7d8q/image/upload/f_auto,q_auto,w_1200/ummo_banners/SLIDER";

function upsertMetaTag(attrName, attrValue, content) {
  if (typeof document === "undefined" || !content) return;
  let el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", String(content));
}

function removeMetaTag(attrName, attrValue) {
  if (typeof document === "undefined") return;
  const el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (el) el.remove();
}

function upsertCanonicalLink(url) {
  if (typeof document === "undefined" || !url) return;
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function upsertJsonLdScript(id, payload) {
  if (typeof document === "undefined") return;
  let script = document.getElementById(id);
  if (!payload) {
    if (script) script.remove();
    return;
  }
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

export function applyPageSeo({
  title,
  description,
  canonicalPath = "/",
  ogType = "website",
  image,
  robots = "index, follow",
  productMeta = null,
  jsonLd = null,
} = {}) {
  if (typeof document === "undefined") return;

  const formattedTitle = title
    ? title.includes("UOMO")
      ? title
      : `${title} | UOMO`
    : DEFAULT_TITLE;
  const cleanDesc = String(description || DEFAULT_DESCRIPTION)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  const cleanPath = canonicalPath.startsWith("/")
    ? canonicalPath
    : `/${canonicalPath}`;
  const canonicalUrl = `${SITE_BASE_URL}${cleanPath}`;
  const resolvedImage =
    image && String(image).startsWith("http")
      ? image
      : image && String(image).startsWith("/")
        ? `${SITE_BASE_URL}${image}`
        : DEFAULT_IMAGE;

  document.title = formattedTitle;
  upsertCanonicalLink(canonicalUrl);

  upsertMetaTag("name", "description", cleanDesc);
  upsertMetaTag("name", "robots", robots);

  upsertMetaTag("property", "og:site_name", "UOMO");
  upsertMetaTag("property", "og:type", ogType);
  upsertMetaTag("property", "og:title", formattedTitle);
  upsertMetaTag("property", "og:description", cleanDesc);
  upsertMetaTag("property", "og:url", canonicalUrl);
  upsertMetaTag("property", "og:image", resolvedImage);

  upsertMetaTag("name", "twitter:card", "summary_large_image");
  upsertMetaTag("name", "twitter:title", formattedTitle);
  upsertMetaTag("name", "twitter:description", cleanDesc);
  upsertMetaTag("name", "twitter:image", resolvedImage);

  if (productMeta && productMeta.price !== undefined) {
    upsertMetaTag(
      "property",
      "product:price:amount",
      Number(productMeta.price).toFixed(2)
    );
    upsertMetaTag(
      "property",
      "product:price:currency",
      productMeta.currency || "USD"
    );
    upsertMetaTag(
      "property",
      "product:availability",
      productMeta.inStock ? "in stock" : "out of stock"
    );
  } else {
    removeMetaTag("property", "product:price:amount");
    removeMetaTag("property", "product:price:currency");
    removeMetaTag("property", "product:availability");
  }

  upsertJsonLdScript("ummo-dynamic-jsonld", jsonLd);
}

export function buildProductSeoConfig(product, discountState, taxonomy) {
  if (!product?.id) return null;
  const price = Number(
    discountState?.effectivePrice ?? product.price ?? 0
  ).toFixed(2);
  const inStock = Number(product.stock ?? 20) > 0;
  const deptName = taxonomy?.departmentName || product.category || "Collection";
  const deptSlug = taxonomy?.department || "women";
  const productUrl = `${SITE_BASE_URL}/shop/${product.id}`;
  const images =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images.filter(Boolean)
      : [product.thumbnail].filter(Boolean);

  const discountLabel =
    discountState?.isDiscountActive && discountState.discountPercentage > 0
      ? ` (-${discountState.discountPercentage}% OFF)`
      : "";

  const seoTitle = `${product.title} — $${price}${discountLabel} | ${deptName}`;
  const seoDesc = `${product.title} by ${product.brand || "UOMO"} ($${price}${discountLabel}). ${
    product.description || "Authentic quality with fast delivery and 30-day returns at UOMO."
  }`;

  const offerObj = {
    "@type": "Offer",
    url: productUrl,
    priceCurrency: "USD",
    price,
    availability: inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    ...(discountState?.endTimeIso
      ? { priceValidUntil: discountState.endTimeIso.slice(0, 10) }
      : {}),
  };

  const productSchema = {
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.title,
    description: product.description || seoDesc,
    sku: product.sku || `UMMO-${product.id}`,
    category: deptName,
    image: images,
    brand: {
      "@type": "Brand",
      name: product.brand || "UOMO",
    },
    offers: offerObj,
    ...(Number(product.rating) > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(Number(product.rating).toFixed(2)),
            reviewCount: Math.max(
              1,
              Array.isArray(product.reviews) ? product.reviews.length : 3
            ),
          },
        }
      : {}),
  };

  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_BASE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${SITE_BASE_URL}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: deptName,
        item: `${SITE_BASE_URL}/category/${deptSlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: product.title,
        item: productUrl,
      },
    ],
  };

  return {
    title: seoTitle,
    description: seoDesc,
    canonicalPath: `/shop/${product.id}`,
    ogType: "product",
    image: images[0],
    productMeta: {
      price: Number(price),
      currency: "USD",
      inStock,
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [productSchema, breadcrumbSchema],
    },
  };
}

export function usePageSeo(config) {
  const serializedKey = JSON.stringify({
    t: config?.title || "",
    d: config?.description || "",
    p: config?.canonicalPath || "/",
    o: config?.ogType || "website",
    i: config?.image || "",
    pm: config?.productMeta || null,
  });

  useEffect(() => {
    if (!config) return;
    applyPageSeo(config);
  }, [serializedKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
