# UMMO ECOMMERCE — SSLCOMMERZ SANDBOX INTEGRATION REPORT

**Status:** CERTIFIED PASS (Sandbox Mode Only)  
**Repository:** `Ummo-Ecommerce`  
**Service Implementation:** `api/paymentService.js`, `api/index.js`, `src/services/api.js`, `src/components/billing/BillingInformation.jsx`, `src/components/ordercomplite/OrderComplete.jsx`

---

## 1. Configuration & Credential Safety

- **Environment Variables Supported (`.env.example` / `api/paymentService.js`):**
  - `SSLCOMMERZ_STORE_ID` (defaults to sandbox fallback `ummo6700sandbox` when running local sandbox simulation)
  - `SSLCOMMERZ_STORE_PASSWORD`
  - `SSLCOMMERZ_MODE=sandbox` (strictly enforced as `sandbox`)
  - `SSLCOMMERZ_SUCCESS_URL`, `SSLCOMMERZ_FAIL_URL`, `SSLCOMMERZ_CANCEL_URL`, `SSLCOMMERZ_IPN_URL`
- **Secret Isolation:** `SSLCOMMERZ_STORE_PASSWORD` is accessed exclusively on the backend (`api/paymentService.js`) and is never exposed in `/api/v1/payments/config` or client bundles.

---

## 2. Architecture & Endpoints

1. **`POST /api/v1/payments/sslcommerz/init` (`initSslCommerzSession`):**
   - Authenticates the caller and loads the server-calculated order from MongoDB (`order.totalAmount`).
   - Ignores any client-supplied amount override to prevent price tampering.
   - Generates a unique transaction reference (`UMMO-SSL-{orderId}-{timestamp}`) and records an `INITIATED` `paymentTransactions` entry and `paymentWebhookEvents` log (`SSLCOMMERZ_SESSION_INITIATED`).
   - When live SSLCommerz Sandbox API credentials are configured (`SSLCOMMERZ_LIVE_SANDBOX=true`), calls `https://sandbox.sslcommerz.com/gwprocess/v4/api.php`; otherwise provides a deterministic local sandbox gateway redirect (`/order-complete?orderId=...&gateway=SSLCOMMERZ&tran_id=...&sandbox=true`) for seamless local and CI testing.
2. **`POST /api/v1/payments/sslcommerz/ipn` & `POST /api/v1/payments/sslcommerz/verify` (`verifySslCommerzPayment`):**
   - Verifies the transaction status (`VALID` / `VALIDATED` / `FAILED` / `CANCELLED`), checks that the paid currency and amount match `order.totalAmount` (`±0.01` tolerance), and flags mismatches as `REQUIRES_REVIEW` (`SSLCOMMERZ_AMOUNT_MISMATCH`).
   - Enforces **webhook/IPN idempotency**: duplicate callbacks for an already-`PAID` order return `alreadyProcessed: true` without double-deducting inventory or duplicating records.
   - On `VALID` payment: transitions `order.paymentStatus = "PAID"`, `order.status = "Processing"`, sets `paidAt`, and atomically deducts product inventory (`deductOrderInventory`) if not already deducted.
   - On `FAILED` or `CANCELLED`: transitions `order.paymentStatus` to `"FAILED"` or `"CANCELED"` and restores reserved stock (`restoreOrderInventory`).

---

## 3. Automated Test Evidence

Verified in `tests/enterprise-qa.test.js` (`Phase 14 — SSLCommerz Sandbox Payment Lifecycle, Verification & Idempotency`):
- Session initiation creates `tran_id` and sets `paymentStatus: "INITIATED"`: **PASS**
- Valid IPN/Verification transitions order to `PAID` and records `val_id`: **PASS**
- Replay of identical IPN payload returns `alreadyProcessed: true` (idempotent): **PASS**
- Tampered amount payload (`amount: 1.00` vs expected order total) is rejected with `400` and flagged `REQUIRES_REVIEW`: **PASS**
- Failed payment callback transitions order to `FAILED` and restores product stock: **PASS**
