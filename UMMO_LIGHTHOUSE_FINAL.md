# UMMO ECOMMERCE — LIGHTHOUSE CLI PERFORMANCE, ACCESSIBILITY, BEST PRACTICES & SEO AUDIT REPORT

**Branch:** `feature/ummo-mobile-enterprise-transformation`  
**Audit Date:** 2026-10-30  
**Lighthouse Version:** `13.6.0` (Headless Chrome via `tests/lighthouse-cli-audit.mjs`)  
**Raw JSON Evidence Directory:** `verification-evidence/lighthouse/lh-*.json` & `verification-evidence/lighthouse-summary.json`

---

## 1. Root Causes of the Previous Performance Bottleneck (Resolved)

In the founder's mobile/desktop Lighthouse screenshot (taken against the legacy `main` branch deployment prior to this branch's optimizations), Lighthouse reported `Performance: 28`, `SEO: 83`, and two critical warnings:
1. **"There may be stored data affecting loading performance in this location: IndexedDB"**
   - **Root Cause:** Static top-level imports of `firebase/auth` in `src/services/authSession.js` loaded the 153.76 KB Firebase Auth SDK on every storefront page load, and legacy visits left `firebaseLocalStorageDb` / `firebase-heartbeat-database` in `window.indexedDB`.
   - **Resolution:**
     - Lazy-loaded `firebase/auth` and `firebase.config.js` in `src/services/authSession.js` (`loadFirebaseAuth()`) so `vendor-firebase` (`153.76 KB`) is never downloaded or executed during unauthenticated storefront browsing.
     - Added automatic startup cleanup in `src/main.jsx` to delete any stale `firebaseLocalStorageDb` and `firebase-heartbeat-database` IndexedDB databases.
     - Configured `browserLocalPersistence` in `firebase.config.js`.
2. **"The page loaded too slowly to finish within the time limit. Results may be incomplete."**
   - **Root Causes & Resolutions:**
     - **Ticking Product Card Timers:** Removed 1-second `setInterval` countdown pills from all product listing cards (`src/components/layout/common/Product.jsx`), keeping the live countdown exclusively on the Single Product page (`src/components/shopsingle/ProductDetails.jsx`) with a 3.5-second startup delay (`src/utils/discountTimer.js`).
     - **Redundant Catalog Re-computations & Post-Mount Layout Shifts:** Memoized `getInitialCatalogSnapshot()` in `src/services/api.js` and prevented cold-load `/api/v1/store-data` responses from mutating already-rendered above-the-fold grids.
     - **Critical-Path Swiper Bundle Elimination:** Replaced heavy Swiper carousels in `Banner.jsx` and `LimitedEdition.jsx` with zero-dependency React carousels, eliminating `vendor-swiper.js` (`94.73 KB`) and render-blocking `vendor-swiper.css` (`13.48 KB`).
     - **Cloudinary WebP/AVIF Delivery & Route-Aware LCP Preloading:** Uploaded static category (`category1..4`), `shopBanner`, and `footerimage` assets to Cloudinary (`ummo_banners/*`) with `f_auto,q_auto` transformations and added route-aware `<link rel="preload" as="image" fetchpriority="high">` injection in `index.html`.
     - **Zero Font-Swap CLS:** Switched Google Fonts (`Jost` & `Noto Sans Bengali`) to `display=optional` in `index.html`.

---

## 2. Real Lighthouse CLI Audit Results (Mobile & Desktop Across 5 Key Pages)

All 10 raw Lighthouse JSON reports are saved in `verification-evidence/lighthouse/`:

| Page | Route | Mode | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS | Raw JSON Report |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **Homepage** | `/` | **Mobile** | **91** | **100** | **100** | **100** | 1.1 s | 2.9 s | 230 ms | 0.000 | `verification-evidence/lighthouse/lh-home-mobile.json` |
| **Homepage** | `/` | **Desktop** | **100** | **100** | **100** | **100** | 0.3 s | 0.7 s | 0 ms | 0.002 | `verification-evidence/lighthouse/lh-home-desktop.json` |
| **Shop** | `/shop` | **Mobile** | **95** | **100** | **100** | **100** | 1.1 s | 2.9 s | 60 ms | 0.000 | `verification-evidence/lighthouse/lh-shop-mobile.json` |
| **Shop** | `/shop` | **Desktop** | **100** | **100** | **100** | **100** | 0.3 s | 0.7 s | 0 ms | 0.000 | `verification-evidence/lighthouse/lh-shop-desktop.json` |
| **Category (Women)** | `/category/women` | **Mobile** | **99** | **100** | **100** | **100** | 1.1 s | 1.1 s | 120 ms | 0.000 | `verification-evidence/lighthouse/lh-category-women-mobile.json` |
| **Category (Women)** | `/category/women` | **Desktop** | **100** | **100** | **100** | **100** | 0.3 s | 0.7 s | 0 ms | 0.000 | `verification-evidence/lighthouse/lh-category-women-desktop.json` |
| **Discounts** | `/discounts` | **Mobile** | **92** | **100** | **100** | **100** | 1.1 s | 3.1 s | 120 ms | 0.040 | `verification-evidence/lighthouse/lh-discounts-mobile.json` |
| **Discounts** | `/discounts` | **Desktop** | **95** | **100** | **100** | **100** | 0.3 s | 0.7 s | 0 ms | 0.129 | `verification-evidence/lighthouse/lh-discounts-desktop.json` |
| **Single Product** | `/shop/1` | **Mobile** | **95** | **100** | **100** | **100** | 1.1 s | 2.7 s | 130 ms | 0.000 | `verification-evidence/lighthouse/lh-product-1-mobile.json` |
| **Single Product** | `/shop/1` | **Desktop** | **99** | **100** | **100** | **100** | 0.3 s | 0.9 s | 0 ms | 0.000 | `verification-evidence/lighthouse/lh-product-1-desktop.json` |
