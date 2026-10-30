# UMMO ECOMMERCE — RESPONSIVE VIEWPORT VERIFICATION MATRIX (GATE 16)

**Branch:** `feature/ummo-mobile-enterprise-transformation`  
**Audit Date:** 2026-10-30

---

## 1. Cross-Device Viewport Matrix (`320px` – `1920px`)

| Viewport | Device Class | Storefront Header & Mobile Drawer | Customer Bottom Nav (`MobileBottomNav`) | Product Grid (`/shop`, `/category/:slug`, `/discounts`) | Single Product (`/shop/:id`) | Customer Profile (`/profile`) | Admin Portal (`/admin`) | Horizontal Overflow |
|---|---|---|---|---|---|---|---|---|
| `320px × 568px` | Small Android / iPhone SE | Compact Top Bar + `86vw` Drawer | 5-tab bar (`56px` height) | 2-col compact cards (no timer overflow) | Stacked gallery + full-width CTAs | Scrollable pill tabs + Order modal | Sticky top bar + `84vw` Admin drawer + Mobile cards | **0px (PASS)** |
| `360px × 800px` | Standard Android Phone | Compact Top Bar + `86vw` Drawer | 5-tab bar (`56px` height) | 2-col cards + slide-out Filter Drawer | Stacked gallery + Limited-Time Timer | Scrollable pill tabs + Order modal | Sticky top bar + `84vw` Admin drawer + Bottom-sheet modals | **0px (PASS)** |
| `390px × 844px` | iPhone 14 / Modern Android | Compact Top Bar + `320px` Drawer | 5-tab bar (`56px` height) | 2-col cards + slide-out Filter Drawer | Stacked gallery + Limited-Time Timer | Scrollable pill tabs + Order modal | Sticky top bar + `300px` Admin drawer + Mobile cards | **0px (PASS)** |
| `412px × 915px` | Pixel / Galaxy S Ultra | Compact Top Bar + `320px` Drawer | 5-tab bar (`56px` height) | 2-col cards + slide-out Filter Drawer | Stacked gallery + Limited-Time Timer | Scrollable pill tabs + Order modal | Sticky top bar + `300px` Admin drawer + Mobile cards | **0px (PASS)** |
| `768px × 1024px` | iPad / Tablet Portrait | Compact Top Bar + `320px` Drawer | 5-tab bar (`56px` height) | 3-col product grid | 2-col gallery + details | 2-col summary grid + Order table/cards | Sticky top bar + Desktop table views (`md:block`) | **0px (PASS)** |
| `1024px × 768px` | Tablet Landscape / Laptop | Full Desktop Nav + Department Links | Hidden (`lg:hidden`) | Left Filter Sidebar + 3-col Grid | 2-col gallery + details | Full Desktop Profile Tabs | Persistent Left Sidebar (`w-60`) + Desktop Tables | **0px (PASS)** |
| `1440px × 900px` | Standard Desktop | Full Desktop Nav + Search + Cart | Hidden (`lg:hidden`) | Left Filter Sidebar + 4-col Grid | Wide 2-col gallery + details | Full Desktop Profile Tabs | Persistent Left Sidebar + 9-KPI Grid + Tables | **0px (PASS)** |
| `1920px × 1080px` | Full HD Widescreen | Centered `1410px` Container | Hidden (`lg:hidden`) | Left Filter Sidebar + 4-col Grid | Centered `1410px` Container | Centered `1410px` Container | Centered `max-w-7xl` Admin Workspace | **0px (PASS)** |
