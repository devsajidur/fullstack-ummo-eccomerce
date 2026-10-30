# UMMO ECOMMERCE — DISCOUNT ENGINE, CARD PRICE REDESIGN & `/discounts` REPORT (GATES 6, 7 & 8)

**Branch:** `feature/ummo-mobile-enterprise-transformation`  
**Audit Date:** 2026-10-30

---

## 1. Gate 6 — Product Listing Card Price & Badge Redesign (`src/components/layout/common/Product.jsx`)

- **Countdown Timer Removed from All Listing Cards:** The `ProductCountdownPill` (`02 DAYS : 07 H : 40 M : 48 S`) has been completely removed from `Product.jsx`. Product cards across `/`, `/shop`, `/category/:slug`, and `/discounts` no longer mount 1-second re-render timers.
- **Clean Price & Badge Display:**
  - When `discountState.isDiscountActive === true`:
    - Displays `-XX% OFF` badge in the top-left corner (`bg-[#C32929] text-white`).
    - Displays **Current Selling Price** (`$XX.XX`) in bold alongside the **Regular Price** (`$YY.YY`) with strikethrough.
  - When `discountState.isDiscountActive === false`:
    - Displays only the regular price (`$YY.YY`) with zero fake strikethrough prices or `-0% OFF` badges.

---

## 2. Gate 7 — Single-Product Page Countdown Timer (`src/components/shopsingle/ProductDetails.jsx`)

- **Isolated Live Countdown Timer:** The ticking countdown timer (`Days : Hours : Minutes : Seconds`) is rendered **ONLY** on the Single Product page (`ProductDetails.jsx`) when `discountState.hasActiveTimer === true`.
- **Automatic Expiration Reversion:** When `remainingMs <= 0`, `getProductDiscountState()` (`src/utils/discountTimer.js`) automatically transitions `isDiscountActive` to `false` and reverts `effectivePrice` to `regularPrice` on both client and server (`api/orderService.js`).

---

## 3. Gate 8 — Dedicated `/discounts` Page & Homepage Deals Section

- **`/discounts` Route (`src/pages/DiscountsPage.jsx`):**
  - Displays only active, non-expired discounted products (`discountState.isDiscountActive === true`).
  - Provides Department filter pills, Minimum Discount % filter (`All Deals`, `10%+ OFF`, `15%+ OFF`, `20%+ OFF`), Search input, Sort selector (`Biggest Discount %`, `Highest Dollar Savings`, `Price: Low to High`, `Price: High to Low`), and a responsive **Mobile Filter Drawer**.
- **Homepage "Best Deals for You" Section (`src/components/layout/home/BestDealsSection.jsx`):**
  - Mounted on `HomePage.jsx` with quick department filter tabs (`All Deals`, `Women`, `Men`, `Kids`, `Beauty`) and direct CTA to `/discounts`.
- **Admin Discount Campaign Manager (`src/components/admin/AdminDiscountsTab.jsx`):**
  - Allows administrators to create, pause, or delete percentage or fixed-amount discount campaigns with `startTime`, `endTime`, department or storewide scope, and overlap detection warnings.
