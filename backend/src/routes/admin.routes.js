import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../middlewares/security.js";

const router = Router();
const prisma = new PrismaClient();

// Protect all admin routes with JWT + ADMIN/SUPER_ADMIN RBAC
router.use(requireAuth, requireRole("ADMIN", "SUPER_ADMIN"));

/**
 * GET /api/v1/admin/overview
 * Enterprise Admin Dashboard KPIs & Pipeline Summary
 */
router.get("/overview", async (req, res, next) => {
  try {
    const [
      totalOrders,
      totalUsers,
      totalProducts,
      activeCoupons,
      revenueAgg,
      recentOrders,
      statusGroups,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.coupon.count({ where: { isActive: true } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { notIn: ["CANCELLED", "REFUNDED"] } },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: true,
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        totalRevenue: Number(revenueAgg._sum.total || 0),
        totalOrders,
        totalUsers,
        totalProducts,
        activeCoupons,
        statusBreakdown: statusGroups.reduce((acc, g) => {
          acc[g.status] = g._count.status;
          return acc;
        }, {}),
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/orders
 * List all orders across all customers for Admin Fulfillment
 */
router.get("/orders", async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = status ? { status: String(status).toUpperCase() } : {};
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: true,
        payment: true,
      },
    });
    return res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/orders/:id/status
 * Update order status & log to immutable AuditLog
 */
const statusSchema = z.object({
  status: z.enum([
    "PENDING",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ]),
});

router.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: "ADMIN_UPDATE_ORDER_STATUS",
        entity: "Order",
        entityId: updated.id,
        metadata: { newStatus: status },
        ipAddress: req.ip,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/coupons
 * List all promo coupons
 */
router.get("/coupons", async (req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { expiresAt: "desc" },
    });
    return res.json({ success: true, data: coupons });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/coupons
 * Create a new promotional coupon
 */
const couponSchema = z.object({
  code: z.string().min(3).max(30),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  minOrderValue: z.number().min(0).default(0),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

router.post("/coupons", async (req, res, next) => {
  try {
    const body = couponSchema.parse(req.body);
    const coupon = await prisma.coupon.create({
      data: {
        code: body.code.toUpperCase().trim(),
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderValue: body.minOrderValue,
        maxUses: body.maxUses,
        expiresAt: body.expiresAt
          ? new Date(body.expiresAt)
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    return res.status(201).json({ success: true, data: coupon });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/users
 * List customers & roles
 */
router.get("/users", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

export default router;
