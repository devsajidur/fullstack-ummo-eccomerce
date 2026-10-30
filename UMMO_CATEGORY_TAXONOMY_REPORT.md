# UMMO ECOMMERCE — INTELLIGENT CATEGORY TAXONOMY REPORT (GATE 5)

**Branch:** `feature/ummo-mobile-enterprise-transformation`  
**Audit Date:** 2026-10-30

---

## 1. Canonical Department & Subcategory Hierarchy (`src/utils/categoryTaxonomy.js`)

The 194-product catalog is organized into 9 primary storefront departments plus an administrative review bucket:

| Department Slug | Display Name (EN) | Display Name (BN) | Subcategories | Mapped Raw Categories |
|---|---|---|---|---|
| `men` | Men's Fashion | পুরুষদের ফ্যাশন | Clothing, Shoes, Watches, Accessories | `mens-shirts`, `mens-shoes`, `mens-watches` |
| `women` | Women's Fashion | নারীদের ফ্যাশন | Clothing, Shoes, Bags, Jewellery, Watches | `womens-dresses`, `tops`, `womens-shoes`, `womens-bags`, `womens-jewellery`, `womens-watches` |
| `kids` | Kids' Collection | শিশুদের কালেকশন | Boys, Girls, Clothing, Footwear, Toys & Care | Keyword & attribute classification + Admin assignments |
| `beauty` | Beauty & Personal Care | বিউটি ও পার্সোনাল কেয়ার | Makeup, Skincare, Personal Care | `beauty`, `skin-care` |
| `fragrances` | Fragrances | সুগন্ধি ও পারফিউম | Designer Perfumes, Eau de Parfum, Body Mist | `fragrances` |
| `electronics` | Electronics & Gadgets | ইলেকট্রনিক্স ও গ্যাজেট | Smartphones, Laptops, Tablets, Audio & Accessories | `smartphones`, `laptops`, `tablets`, `mobile-accessories` |
| `home-living` | Home & Living | হোম ও লিভিং | Furniture, Home Decor, Kitchen & Dining | `furniture`, `home-decoration`, `kitchen-accessories` |
| `sports` | Sports & Outdoors | স্পোর্টস ও আউটডোর | Activewear & Gear, Sunglasses, Automotive & Cycling | `sports-accessories`, `sunglasses`, `motorcycle`, `vehicle` |
| `groceries` | Groceries & Essentials | গ্রোসারি ও নিত্যপ্রয়োজনীয় | Daily Essentials, Beverages & Snacks, Fresh & Pantry | `groceries` |
| `uncategorized` | Uncategorized / Needs Review | পর্যালোচনা প্রয়োজন | Needs Review | Fallback bucket surfaced in Admin Review Queue |

---

## 2. Dedicated Department Route (`/category/:slug` — `src/pages/CategoryPage.jsx`)

- Supports `/category/men`, `/category/women`, `/category/kids`, `/category/beauty`, `/category/fragrances`, `/category/electronics`, `/category/home-living`, `/category/sports`, `/category/groceries`, and any custom department created by Admin.
- Features department hero banner, department switcher pills, subcategory filter pills, search input, sort selector (`Featured`, `Price: Low to High`, `Price: High to Low`, `Biggest Discount`, `Highest Rated`), desktop filter sidebar, and a slide-out **Mobile Filter Drawer** (Brand, Max Price slider, On-Sale toggle, In-Stock toggle).
- Zero cross-department contamination: Men's, Women's, and Kids' pages strictly display products matching their respective department classification.
