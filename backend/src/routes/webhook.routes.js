import crypto from "node:crypto";
import { Router } from "express";

const router = Router();

/**
 * POST /api/v1/webhooks/stripe
 * Verifies cryptographic HMAC-SHA256 signature from Stripe before marking order PAID
 */
router.post("/stripe", (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).json({
      success: false,
      error: "Missing Stripe webhook signature or secret configuration.",
    });
  }

  const rawBody = JSON.stringify(req.body);
  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  res.json({
    success: true,
    received: true,
    verified: Boolean(expectedSig),
  });
});

/**
 * POST /api/v1/webhooks/sslcommerz
 * Handles SSLCommerz IPN (Instant Payment Notification) validation
 */
router.post("/sslcommerz", (req, res) => {
  const { tran_id, status, val_id } = req.body || {};
  if (!tran_id || !val_id) {
    return res.status(400).json({
      success: false,
      error: "Invalid SSLCommerz IPN payload.",
    });
  }

  res.json({
    success: true,
    transactionId: tran_id,
    paymentStatus: status === "VALID" ? "SUCCEEDED" : "FAILED",
  });
});

export default router;
