import { Router } from "express";
import { z } from "zod";
import { getCatalogProducts } from "./product.routes.js";
import { generateOrderNumber } from "../utils/crypto.js";

const router = Router();

// Server-side authoritative shipping table (prevents client shipping manipulation)
const SHIPPING_RATES = {
  free: 0,
  flat: 49,
  pickup: 8,
};

const VAT_FLAT = 19;

// Idempotency & Order storage
const idempotencyStore = new Map();
const ordersStore = new Map();

const checkoutSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  items: z
    .array(
      z.object({
        productId: z.union([z.number(), z.string()]),
        quantity: z.number().int().positive().max(99),
      })
    )
    .min(1, "Order must contain at least 1 item"),
  shippingMethod: z.enum(["free", "flat", "pickup"]).default("free"),
  paymentMethod: z.string().min(1),
  billing: z.object({
    company: z.string().optional(),
    country: z.string().min(1),
    streetAddress: z.string().min(1),
    apartment: z.string().optional(),
    city: z.string().min(1),
    postcode: z.string().min(1),
    province: z.string().min(1),
    phone: z.string().min(3),
    orderNotes: z.string().optional(),
  }),
});

/**
 * POST /api/v1/orders/checkout
 * Enterprise Server-Side Price Calculation, Atomic Stock Verification & Idempotency
 */
router.post("/checkout", async (req, res, next) => {
  try {
    const idempotencyKey = req.headers["idempotency-key"];
    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      return res.json(idempotencyStore.get(idempotencyKey));
    }

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0].message,
      });
    }

    const { userId, email, items, shippingMethod, paymentMethod, billing } =
      parsed.data;

    const catalog = await getCatalogProducts();

    // 1. Verify stock and compute subtotal strictly from server catalog prices
    let computedSubtotal = 0;
    const verifiedOrderItems = [];

    for (const reqItem of items) {
      const product = catalog.find(
        (p) => String(p.id) === String(reqItem.productId)
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product ID ${reqItem.productId} does not exist.`,
        });
      }

      if (product.stock < reqItem.quantity) {
        return res.status(409).json({
          success: false,
          error: `Insufficient stock for "${product.title}". Available: ${product.stock}`,
        });
      }

      const lineTotal = Number(product.price) * reqItem.quantity;
      computedSubtotal += lineTotal;

      verifiedOrderItems.push({
        id: product.id,
        title: product.title,
        price: Number(product.price),
        quantity: reqItem.quantity,
        image: product.thumbnail,
      });
    }

    // 2. Atomically deduct stock from catalog
    for (const verified of verifiedOrderItems) {
      const product = catalog.find((p) => p.id === verified.id);
      if (product) {
        product.stock -= verified.quantity;
      }
    }

    const shippingCost = SHIPPING_RATES[shippingMethod] ?? 0;
    const grandTotal = Number(
      (computedSubtotal + shippingCost + VAT_FLAT).toFixed(2)
    );
    const orderNumber = generateOrderNumber();

    const orderRecord = {
      orderNumber,
      userId,
      email,
      status: "PENDING",
      OrderItems: verifiedOrderItems,
      subtotal: Number(computedSubtotal.toFixed(2)),
      shipping: shippingCost,
      shippingMethod,
      vat: VAT_FLAT,
      total: grandTotal,
      paymentMethod,
      billing,
      date: new Date().toISOString(),
    };

    ordersStore.set(orderNumber, orderRecord);

    const responsePayload = {
      success: true,
      data: {
        order: orderRecord,
      },
    };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, responsePayload);
    }

    res.status(201).json(responsePayload);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/orders/:orderNumber
 */
router.get("/:orderNumber", (req, res) => {
  const order = ordersStore.get(req.params.orderNumber);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: "Order not found.",
    });
  }

  res.json({
    success: true,
    data: { order },
  });
});

export default router;
