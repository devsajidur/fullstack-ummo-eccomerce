# UMMO Ecommerce — Complete Data Storage & Persistence Audit

## 1. Executive Summary

- **Database Engine**: MongoDB Atlas (`ummo_ecommerce`).
- **Live Read-Only Collection Snapshot**: `users: 7`, `orders: 5`, `payments: 2`, `store_config: 2` (`_id: "global"` with `4` admin custom/edited products, `_id: "security_guard"`), `subscribers: 1`, `addresses: 0`, `messages: 0`, `reviews: 0` (created on first submitted review).
- **Why Atlas Has Compact Document Counts**:
  1. **Base Catalog (`194` items)** lives in static seed modules (`src/data/catalog/catalogSeedPart1..6.js`). Only admin-created or admin-modified overrides (`customProducts`, `deletedIds`) are saved to MongoDB.
  2. **Consolidated Store Configuration**: Banners, featured collections, coupons, discount campaigns, custom taxonomy, cart rules, and custom products are stored inside a **single** document (`store_config._id = "global"`) rather than separate per-item collections.
  3. **Browser-Local Shopping State**: Active shopping carts (`carts`) and wishlists (`wishList`) are intentionally stored in browser `localStorage` for instant guest and customer browsing; items only enter MongoDB when an order is placed (`orders`).
- **Critical Data-Loss Vulnerability Fixed**:
  - **Root Cause Found**: Previously, write endpoints (`POST /orders`, `PATCH /orders/status`, `POST /payments/*`, `POST /store-config`, `POST /users`, `POST /addresses`, `POST /reviews`, `POST /messages`, `POST /subscribers`) swallowed `db === null` or MongoDB write errors (`.catch(() => {})`), mutated volatile serverless memory (`inMemoryState`), and returned `HTTP 200`/`201`. Meanwhile, `BillingInformation.jsx` only aborted checkout on `4xx` responses, falling back to `localStorage` on `5xx` errors. Because Vercel production had `mongodbConnected: false`, live orders/admin edits risked being falsely acknowledged in volatile memory and lost on serverless cold start.
  - **Fail-Closed Fix Implemented**: All authoritative write routes now call `requireDurableMongoDb()` and `commitDurableMongoWrite()` (`api/db.js`), returning `HTTP 503` (`code: "DB_UNAVAILABLE"` / `"DB_WRITE_FAILED"`) without mutating server memory when MongoDB is unreachable. Frontend checkout (`BillingInformation.jsx`) now aborts order completion and preserves the customer's cart on any backend error.

---

## 2. Authoritative Data Source Mapping (26 Domains)

Classification key: `MONGODB` | `FIREBASE AUTH` | `FIRESTORE / REALTIME DATABASE` | `CLOUDINARY` | `LOCAL STORAGE` | `SESSION STORAGE` | `MEMORY CACHE` | `STATIC CODE` | `UNVERIFIED`

| # | Data Domain | Authoritative Source | MongoDB Collection / Doc | External Service | Browser Storage (Cache / Local) | Server Memory Cache | Survives Refresh | Survives Restart | Cross-Device Sync |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Customer identity** | `FIREBASE AUTH` | — (UID linked in `users`) | Firebase Auth (`firebase/auth`) | `LOCAL STORAGE`: `firebase:authUser:*`, `ummo_active_user` | None | Yes | Yes | Yes |
| 2 | **Customer profile** | `MONGODB` | `users` (`{ uid }`) | Firebase Auth (initial display name/photo) | `LOCAL STORAGE`: `ummo_active_user` (mirror) | `MEMORY CACHE`: `inMemoryState.users` (3s TTL) | Yes | Yes (with DB) | Yes |
| 3 | **Admin identity & credentials** | `MONGODB` | `store_config` (`_id: "security_guard"` -> `ownerAuth.passwordHash` `scrypt`); role in `users` | Env fallback `ADMIN_PASSWORD_HASH` (lower priority) | `SESSION STORAGE` & `LOCAL STORAGE`: `ummo_admin_session_token` (signed HMAC) | `MEMORY CACHE`: `securityGuardCache` (5s TTL) | Yes | Yes (with DB) | Yes |
| 4 | **Products (base catalog)** | `STATIC CODE` + `MONGODB` | `store_config` (`_id: "global"` -> `customProducts`, `deletedIds`) | — | `LOCAL STORAGE`: `ummo_admin_custom_products_v1`, `ummo_admin_deleted_ids_v1` (cache) | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes | Yes |
| 5 | **Custom products** | `MONGODB` | `store_config` (`_id: "global"` -> `customProducts[]`, currently `4` items) | — | `LOCAL STORAGE`: `ummo_admin_custom_products_v1` (cache) | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 6 | **Product variants** | `MONGODB` + `STATIC CODE` | `store_config` (`_id: "global"` -> `customProducts[].sizes`, `colors`, `hasSizes`, `hasColors`) | — | Cached inside `ummo_admin_custom_products_v1` | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 7 | **Product images** | `CLOUDINARY` (media) + `MONGODB` (URLs) | `store_config.global.customProducts[].thumbnail/images`; `orders[].OrderItems[].productImageSnapshot` | Cloudinary (`wxjt7d8q`, folder `ummo_products`) | Cached URLs only (zero binary data in DB/storage) | URLs in `inMemoryState` | Yes | Yes | Yes |
| 8 | **Category configuration** | `MONGODB` + `STATIC CODE` | `store_config` (`_id: "global"` -> `customTaxonomy`) + `categoryTaxonomy.js` | — | `LOCAL STORAGE`: `ummo_admin_taxonomy_v1` (cache) | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 9 | **Banners** | `MONGODB` (config) + `CLOUDINARY` (media) | `store_config` (`_id: "global"` -> `banners`) | Cloudinary (`ummo_banners`) | `LOCAL STORAGE`: `ummo_admin_banners_v3` (cache) | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 10 | **Featured collections** | `MONGODB` (config) + `CLOUDINARY` (media) | `store_config` (`_id: "global"` -> `featuredCollection`) | Cloudinary (`ummo_banners`) | `LOCAL STORAGE`: `ummo_admin_featured_collection_v1` (cache) | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 11 | **Discounts** | `MONGODB` + `STATIC CODE` | `store_config` (`_id: "global"` -> `discountCampaigns`, `customProducts[].discountPercentage`) | — | `LOCAL STORAGE`: `ummo_admin_discount_campaigns_v1` (cache) | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 12 | **Coupons** | `MONGODB` | `store_config` (`_id: "global"` -> `coupons[]`) | — | `LOCAL STORAGE`: `ummo_admin_coupons_v2` (cache), `appliedCoupon` (active cart) | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 13 | **Cart contents** | `LOCAL STORAGE` | — (Committed to `orders` on checkout) | — | `LOCAL STORAGE`: `carts`, `shippingMethod`, `ummo_gift_wrap`, `ummo_gift_note` | None | Yes | Yes (browser) | **No** (browser-local) |
| 14 | **Cart item messages** | `LOCAL STORAGE` (bag) -> `MONGODB` (order) | `orders` (`OrderItems[].optionalMessage` once ordered) | — | `LOCAL STORAGE`: `carts[].optionalMessage` | None (in bag) | Yes | Yes | On order only |
| 15 | **Wishlist** | `LOCAL STORAGE` | — | — | `LOCAL STORAGE`: `wishList` | None | Yes | Yes (browser) | **No** (browser-local) |
| 16 | **Customer addresses** | `MONGODB` | `addresses` (`{ userUid, items[] }`) | — | `LOCAL STORAGE`: `ummo_default_address`, `ummo_address_book_<uid>` (cache) | `MEMORY CACHE`: `inMemoryState.addresses` | Yes | Yes (with DB) | Yes |
| 17 | **Orders** | `MONGODB` | `orders` (`{ orderId }`, server-priced & idempotent) | — | `LOCAL STORAGE`: `ummo_local_orders`, `ummo_synced_user_orders` (read cache) | `MEMORY CACHE`: `inMemoryState.orders` | Yes | Yes (with DB) | Yes |
| 18 | **Order items** | `MONGODB` | `orders` (embedded `OrderItems[]` array per order) | — | Cached inside `ummo_synced_user_orders` | `MEMORY CACHE`: `inMemoryState.orders` | Yes | Yes (with DB) | Yes |
| 19 | **Payments** | `MONGODB` | `payments` (`{ paymentId }`) & `orders.paymentStatus` | Stripe Test / SSLCommerz Sandbox | None | `MEMORY CACHE`: `inMemoryState.payments` | Yes | Yes (with DB) | Yes |
| 20 | **Refunds** | `MONGODB` | `payments` (`refunds[]`, `refundedAmount`) & `orders` (`refundedAmount`, `paymentStatus`) | — | None | `MEMORY CACHE`: `inMemoryState.payments` | Yes | Yes (with DB) | Yes |
| 21 | **Inventory** | `MONGODB` + `STATIC CODE` | `store_config` (`_id: "global"` -> `customProducts[].stock` overrides) | — | Cached inside `ummo_admin_custom_products_v1` | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 22 | **Customer messages** | `MONGODB` | `messages` (`{ id }`) | — | `LOCAL STORAGE`: `ummo_contact_messages_v1` (cache) | `MEMORY CACHE`: `inMemoryState.messages` | Yes | Yes (with DB) | Yes |
| 23 | **Subscribers** | `MONGODB` | `subscribers` (`{ email }`) | — | `LOCAL STORAGE`: `ummo_newsletter_subscribers_v1` (cache) | `MEMORY CACHE`: `inMemoryState.subscribers` | Yes | Yes (with DB) | Yes |
| 24 | **Reviews** | `MONGODB` + `STATIC CODE` | `reviews` (`{ productId, items[] }`) | — | `LOCAL STORAGE`: `ummo_product_reviews_<id>` (cache) | `MEMORY CACHE`: `inMemoryState.reviews` | Yes | Yes (with DB) | Yes |
| 25 | **Store settings** | `MONGODB` | `store_config` (`_id: "global"` -> `cartRules`) | — | `LOCAL STORAGE`: `ummo_admin_cart_rules_v2` (cache) | `MEMORY CACHE`: `inMemoryState.storeConfig` | Yes | Yes (with DB) | Yes |
| 26 | **Admin security data** | `MONGODB` | `store_config` (`_id: "security_guard"` -> `ownerAuth`, `revokedTokens`, `loginAttempts`) | — | None (tokens only in session/local storage) | `MEMORY CACHE`: `securityGuardCache` (5s TTL) | Yes | Yes (with DB) | Yes |

---

## 3. Service-Specific Verification

### 3.1 Firebase Investigation (`FIREBASE AUTH` Only — Zero `FIRESTORE / REALTIME DATABASE`)
- Inspected `firebase.config.js` and all imports across `src/` and `api/`: only `firebase/app` (`initializeApp`) and `firebase/auth` (`getAuth`, `GoogleAuthProvider`, `signInWithPopup`, `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `sendPasswordResetEmail`) are imported.
- **Firestore**: **NOT USED** (`0` references).
- **Realtime Database**: **NOT USED** (`0` references).
- **Firebase Cloud Storage**: **NOT USED** (`0` references).
- Customer passwords and OAuth tokens remain managed strictly by Firebase Authentication and are never copied into MongoDB.

### 3.2 Cloudinary Investigation (`CLOUDINARY` Media Assets Only)
- Inspected `api/_routes/adminAndMediaRoutes.js` (`/api/v1/cloudinary-sign`) and `api/db.js`:
  - Cloudinary (`wxjt7d8q`) is restricted to signed admin image uploads (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`, max `5 MB`) in folders `ummo_products`, `ummo_banners`, and `ummo_gifts`.
  - No JSON state or database mirror blobs are stored in Cloudinary (`saveCloudMirrorState` only updates in-process memory after a verified MongoDB write).
  - Returned HTTPS URLs are stored in `store_config._id="global"` (`customProducts`, `banners`, `featuredCollection`) and snapshotted on `orders.OrderItems[].productImageSnapshot`. No binary image data is stored in MongoDB.

### 3.3 Browser Storage & Guest Cart Contract (`LOCAL STORAGE` / `SESSION STORAGE`)
- Shopping bag items (`carts`), shipping selection (`shippingMethod`), active coupon (`appliedCoupon`), gift wrap (`ummo_gift_wrap`, `ummo_gift_note`), and `wishList` are stored in browser `localStorage` via Redux (`src/slices/cartSlice.js`, `src/slices/wishListSlice.js`).
- **Cross-device behavior**: Carts and wishlists are browser-local for both guest and signed-in customers and do **not** sync across devices prior to checkout. Once an order is placed, the order, its items, variants, and optional product messages are durably saved in MongoDB Atlas (`ummo_ecommerce.orders`) and sync across all devices for that customer.
