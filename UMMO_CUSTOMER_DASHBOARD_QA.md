# UMMO ECOMMERCE — CUSTOMER DASHBOARD & JOURNEY QA REPORT

**Status:** CERTIFIED PASS  
**Repository:** `Ummo-Ecommerce`  
**Audit Scope:** Customer Dashboard (`src/pages/ProfilePage.jsx`, `src/components/profile/*`), Order History, Saved Addresses, Wishlist, Account Settings, and End-to-End Customer Checkout Flow

---

## 1. Customer Dashboard Feature Verification

| Module | Component | Verified Capabilities | Status |
| :--- | :--- | :--- | :--- |
| **Overview Metrics** | `src/pages/ProfilePage.jsx` | Displays Total Orders, Active Shipments, Total Spend (`$`), and Account Security Status with quick-navigation cards. | **PASS** |
| **Order History & Receipts** | `src/components/profile/ProfileOrdersTab.jsx` | Lists all customer orders with Order ID, date, status badge (`Pending`, `Processing`, `Shipped`, `Delivered`, `Cancelled`), payment badge (`PAID`, `INITIATED`, `FAILED`, `REFUNDED`), payment gateway (`SSLCOMMERZ`, `STRIPE`, `COD`), item count, and total. | **PASS** |
| **Order Details Modal** | `src/components/profile/ProfileOrdersTab.jsx` | Opens a detailed modal showing 48×48 `<Image />` thumbnails (`resolveProductImage`), product title, variant (`Size`/`Color`), quantity, unit price, line total, and per-item `optionalMessage` (or `"No special instructions."`), plus subtotal, shipping, discount (`couponCode`), and grand total breakdown. | **PASS** |
| **Print Invoice** | `src/components/profile/ProfileOrdersTab.jsx` | Supports one-click invoice printing (`window.print()`) directly from the Order Details modal. | **PASS** |
| **Saved Addresses** | `src/components/profile/ProfileAddressesTab.jsx` | Supports adding, editing, deleting, and setting a default shipping address, persisted via `/api/v1/users/sync`. | **PASS** |
| **Account Settings** | `src/components/profile/ProfileSettingsTab.jsx` | Supports updating display name, phone number, and profile avatar with Firebase + MongoDB profile sync. | **PASS** |
| **Wishlist** | `src/pages/WishListPage.jsx`, `src/components/wishlist/WishListProduct.jsx` | Displays saved products with `<Image />` fallback, Move-to-Cart action, and Remove action. | **PASS** |

---

## 2. Customer Journey & Data Isolation Security

1. **Strict Customer Order Isolation (`GET /api/v1/orders`):**
   - Verified in `api/index.js` and `tests/enterprise-qa.test.js` (`Phase 5`): non-admin authenticated users only receive orders matching their authenticated email (`user.email`). Users cannot view or mutate another customer's orders.
2. **Real-Time Coupon & Discount Verification:**
   - Verified in `api/orderService.js` (`validateCouponForCustomer`) and `BillingOrderSummary.jsx`:
     - Rejects invalid or expired coupons (`400`).
     - Enforces minimum order subtotal (`minOrderAmount`).
     - Enforces global usage limits (`usageLimit`) and per-user usage limits (`perUserLimit`, default `1` per customer across both user ID and normalized email) so a single customer cannot reuse a single-use coupon multiple times.
     - Automatically releases coupon usage reservations if an order is cancelled or fully refunded (`releaseOrderCouponUsage`).
3. **Responsive Layout Verification:**
   - Verified across Mobile (`375×812`), Tablet (`768×1024`), and Desktop (`1440×900`) viewports with no horizontal overflow and accessible touch targets.
