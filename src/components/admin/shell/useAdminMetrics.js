import { useMemo } from "react";
import {
  normalizeColorList,
  normalizeSizeList,
} from "../../../utils/productVariants";

export function useAdminMetrics(orders, products, customers) {
  return useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELLED");
    const totalRevenue = validOrders.reduce(
      (sum, o) => sum + Number(o.total ?? o.totalAmount ?? 0),
      0
    );
    const paidOrders = orders.filter((o) => o.paymentStatus === "PAID");
    const paidRevenue = paidOrders.reduce(
      (sum, o) =>
        sum +
        Math.max(
          0,
          Number(o.total ?? o.totalAmount ?? 0) - Number(o.refundedAmount || 0)
        ),
      0
    );
    const failedOrRefundedCount = orders.filter((o) =>
      [
        "FAILED",
        "CANCELED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
        "REQUIRES_REVIEW",
      ].includes(o.paymentStatus)
    ).length;
    const avgOrderValue =
      validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
    const pendingOrders = orders.filter(
      (o) => (o.status || "PENDING") === "PENDING"
    ).length;
    const lowStockProducts = products.filter(
      (p) => Number(p.stock ?? 20) > 0 && Number(p.stock ?? 20) < 10
    ).length;
    const outOfStockProducts = products.filter(
      (p) => Number(p.stock ?? 20) <= 0
    ).length;

    return {
      totalRevenue,
      paidRevenue,
      paidOrdersCount: paidOrders.length,
      failedOrRefundedCount,
      avgOrderValue,
      totalOrders: orders.length,
      pendingOrders,
      totalProducts: products.length,
      lowStockProducts,
      outOfStockProducts,
      totalCustomers: customers.length,
    };
  }, [orders, products, customers]);
}

export function normalizeAdminProductSubmission(arg1, arg2) {
  const isDirectPayload =
    arg1 && typeof arg1 === "object" && typeof arg2 === "boolean";
  const isEditing = isDirectPayload ? arg2 : Boolean(arg1);
  const productForm = isDirectPayload ? arg1 : arg2 || {};
  const editingProduct = isDirectPayload ? (arg2 ? arg1 : null) : arg1;

  const cleanThumb = String(productForm.thumbnail || "").trim();
  const galleryImages = Array.isArray(productForm.images)
    ? productForm.images.filter(Boolean)
    : [];
  const mergedGallery = cleanThumb
    ? [cleanThumb, ...galleryImages.filter((u) => u !== cleanThumb)]
    : galleryImages;

  const sizesList = normalizeSizeList(
    Array.isArray(productForm.sizes)
      ? productForm.sizes
      : productForm.sizesInput || ""
  );
  const colorsList = normalizeColorList(
    Array.isArray(productForm.colors)
      ? productForm.colors
      : productForm.colorsInput || ""
  );

  const freeGift =
    productForm.freeGift && typeof productForm.freeGift === "object"
      ? productForm.freeGift
      : productForm.freeGiftEnabled &&
          String(productForm.freeGiftName || "").trim()
        ? {
            enabled: true,
            minBuyQty: Math.max(1, Number(productForm.freeGiftMinBuyQty) || 1),
            giftName: String(productForm.freeGiftName).trim(),
            giftQty: Math.max(1, Number(productForm.freeGiftQty) || 1),
            giftImage: String(productForm.freeGiftImage || "").trim(),
            giftProductId: productForm.freeGiftProductId || "",
          }
        : { enabled: false };

  const isVisible = productForm.isVisible !== false;
  const nowId = Date.now();
  const payload = {
    id: productForm.id || (editingProduct ? editingProduct.id : nowId),
    title: String(productForm.title || "").trim(),
    department: String(productForm.department || "women").trim(),
    subcategory: String(productForm.subcategory || "Clothing").trim(),
    category: String(productForm.category || "fashion").trim(),
    brand: String(productForm.brand || "UOMO").trim() || "UOMO",
    price: Number(productForm.price) || 29.99,
    discountPercentage: Number(productForm.discountPercentage) || 0,
    discountEndTime: productForm.discountEndTime || "none",
    freeGift,
    stock: Math.max(0, Number(productForm.stock ?? 0)),
    sku: String(productForm.sku || "").trim() || `UMMO-${nowId}`,
    thumbnail: mergedGallery[0] || cleanThumb,
    images: mergedGallery.length
      ? mergedGallery
      : [cleanThumb].filter(Boolean),
    sizes: sizesList,
    colors: colorsList,
    hasCustomVariants: true,
    isVisible,
    isFeatured: Boolean(productForm.isFeatured),
    status: isVisible ? "active" : "draft",
    description: String(productForm.description || "").trim(),
    rating: productForm.rating || editingProduct?.rating || 4.8,
    isCustomNew:
      !isEditing ||
      Boolean(productForm.isCustomNew || editingProduct?.isCustomNew),
  };

  return { payload, isEditing };
}
