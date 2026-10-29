# UMMO ECOMMERCE — PRODUCT-SPECIFIC OPTIONAL CUSTOMER MESSAGES REPORT

**Status:** CERTIFIED PASS  
**Repository:** `Ummo-Ecommerce`  
**Audit Scope:** Product Details, Shopping Cart, Checkout Summary, Order Persistence (`api/orderService.js`), Customer Order History, Order Confirmation, and Admin Order Fulfillment

---

## 1. Feature Specification & UX Implementation

Customers can attach an optional per-item instruction (`"Message for this product (optional)"`) at any point prior to order placement:

- **Field Label:** `Message for this product (optional)`
- **Placeholder:** `e.g., Please gift wrap this item / Call before delivery / Pack separately / Custom size note`
- **Character Limit:** `500` Unicode characters with a live counter (`0/500`)
- **Empty Behavior:** Completely optional; never blocks Add-to-Cart or Checkout when left empty. Displays `"No special instructions."` in read-only order receipts and fulfillment views when omitted.

### 1.1 Interactive Entry Surfaces
1. **Product Details Page (`src/components/shopsingle/ProductDetails.jsx`):**
   - Renders the optional message input with a live `0/500` character counter before clicking **ADD TO CART**.
   - Dispatches `addToCart` including `optionalMessage: productNote`.
2. **Shopping Cart (`src/components/cart/cartproductDesign/CartProduct.jsx` & `src/pages/CartPage.jsx`):**
   - Both desktop table rows and mobile cart cards provide an inline input (`data-testid="cart-item-message-input-{id}"`) allowing customers to add, edit, or clear each line item's message with immediate Redux + `localStorage` persistence via `updateItemMessage`.
3. **Checkout Order Summary (`src/components/billing/BillingOrderSummary.jsx`):**
   - Each line item in the checkout summary displays an editable input (`data-testid="checkout-item-message-input-{id}"`) with a `0/500` counter so customers can make last-minute item instruction adjustments right before submitting payment.

---

## 2. Line-Item Separation & Data Model Integrity

### 2.1 Distinct Cart Lines for Distinct Messages (`src/slices/cartSlice.js`)
In `src/slices/cartSlice.js`, cart line matching uses `isSameVariantAndMessage(item, payload)`:
- Adding the same product with the **same** variant and **same** message increments the existing line's quantity.
- Adding the same product with a **different** `optionalMessage` creates a **separate cart line item**, preserving distinct instructions per unit/group (e.g., 1× Watch with `"Gift wrap in blue"` and 1× Watch with `"Standard box for personal use"`).

### 2.2 Backend Validation & XSS Sanitization (`api/orderService.js`)
`sanitizeProductMessage(rawMsg)` in `api/orderService.js` enforces strict server-side validation:
1. Converts null/undefined to `""`.
2. Strips `<script>...</script>` blocks, HTML tags (`<...>`), `javascript:` pseudo-protocols, and inline event handlers (`onload=`, `onerror=`, etc.), then removes stray angle brackets (`<`, `>`).
3. Counts Unicode code points (`Array.from(cleaned).length`) and throws HTTP `400 Bad Request` (`"Product message cannot exceed 500 characters."`) if the message exceeds 500 characters.
4. Persists `optionalMessage` on each `OrderItem` record alongside `productId`, `variantId`, `productNameSnapshot`, `productImageSnapshot`, `unitPriceSnapshot`, `quantity`, and `lineSubtotal`.

---

## 3. Read-Only Display Surfaces

1. **Order Confirmation (`src/components/ordercomplite/OrderComplete.jsx`):**
   - Displays `Message: "{item.optionalMessage}"` in an amber highlight badge when present, or `"No special instructions."` when empty.
2. **Customer Order History (`src/components/profile/ProfileOrdersTab.jsx`):**
   - Displays each item's custom message or `"No special instructions."` in the Order Details modal.
3. **Admin Order Fulfillment (`src/components/admin/AdminOrdersTab.jsx`):**
   - Displays a `[Note attached]` indicator on the orders table row and highlights the full `optionalMessage` inside the Admin Order Details modal (`"Message for this product"` box) so warehouse/fulfillment staff never miss customer instructions.

---

## 4. Automated Test Evidence

Verified in `tests/enterprise-qa.test.js` (`Phase 13 — Product-Specific Optional Customer Messages`):
- Empty message (`""`) accepted and stored cleanly: **PASS**
- Valid Unicode message (Bangla + English + Emoji) preserved accurately: **PASS**
- Exact 500-character message accepted: **PASS**
- 501-character message rejected with HTTP `400`: **PASS**
- Malicious XSS payload (`<script>alert("xss")</script><b>Call before delivery</b>`) stripped of executable script/HTML tags while preserving safe text: **PASS**
- Multi-item order with two units of the same product carrying different messages persists two distinct `OrderItems` with their respective messages intact: **PASS**
