# UMMO ECOMMERCE — PAYMENT & REFUND INDEPENDENT AUDIT REPORT (GATES 13 & 14)

**Branch:** `feature/ummo-mobile-enterprise-transformation`  
**Audit Date:** 2026-10-30

---

## 1. Gate 13 — Partial Refund vs. Full Refund Inventory Restock Separation

- **Defect Identified & Fixed (`api/paymentService.js`, `src/components/admin/AdminOrdersTab.jsx`):**
  - Previously, `restockItems` defaulted to `true` in `refundPaymentByAdmin`, and `AdminOrdersTab.jsx` kept `restockOnRefund = true` even when the administrator typed a partial refund amount.
  - **Backend Fix (`api/paymentService.js`):**
    - `restockItems` now defaults to `false`.
    - Inventory restocking (`restockOrderInventory`) is executed **ONLY** when `Boolean(restockItems) === true` and `!order.inventoryRestocked`.
    - Partial refunds (`nextRefundedAmount < orderTotal`) transition `paymentStatus` to `"PARTIALLY_REFUNDED"` without cancelling the order or restocking inventory.
  - **Admin UI Fix (`src/components/admin/AdminOrdersTab.jsx`):**
    - Entering a refund amount smaller than the remaining order balance automatically sets `restockOnRefund` to `false` and labels the confirmation button `Confirm Partial Refund`.

---

## 2. Gate 14 — Sandbox Payment Simulation Hardening (`api/index.js`, `src/components/ordercomplite/OrderComplete.jsx`)

- **Backend Endpoint Hardening (`POST /api/v1/payments/sandbox-confirm`):**
  - Explicitly blocked when `process.env.PAYMENT_ENV === "production"` (`403 Forbidden`).
  - Requires authenticated caller who is either the order owner or a verified Administrator (`canAccessOrder`).
- **Frontend UI Hardening (`src/components/ordercomplite/OrderComplete.jsx`):**
  - The Sandbox Payment Gateway Verification Panel is rendered **only** when `sandbox=1` is present in the URL query string and `VITE_PAYMENT_MODE !== "production"`.
