import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middlewares/security.js";

const router = Router();

// In-memory hot cache for product catalog
let catalogCache = {
  products: [],
  loadedAt: 0,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCatalogProducts() {
  const now = Date.now();
  if (catalogCache.products.length > 0 && now - catalogCache.loadedAt < CACHE_TTL_MS) {
    return catalogCache.products;
  }

  const response = await fetch("https://dummyjson.com/products?limit=200");
  const data = await response.json();
  catalogCache = {
    products: data.products || [],
    loadedAt: now,
  };
  return catalogCache.products;
}

/**
 * GET /api/v1/products
 * Supports server-side filtering, brand/category facets, price range, sorting, and pagination
 */
router.get("/", async (req, res, next) => {
  try {
    const allProducts = await getCatalogProducts();
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      q,
      sort = "default",
      page = "1",
      limit = "200",
    } = req.query;

    let filtered = [...allProducts];

    if (category) {
      filtered = filtered.filter((p) => p.category === category);
    }

    if (brand) {
      const brandList = String(brand).split(",");
      filtered = filtered.filter((p) => brandList.includes(p.brand));
    }

    if (minPrice !== undefined) {
      filtered = filtered.filter((p) => p.price >= Number(minPrice));
    }

    if (maxPrice !== undefined) {
      filtered = filtered.filter((p) => p.price <= Number(maxPrice));
    }

    if (q) {
      const query = String(q).toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query)
      );
    }

    if (sort === "low") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sort === "high") {
      filtered.sort((a, b) => b.price - a.price);
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(250, Math.max(1, parseInt(String(limit), 10) || 200));
    const startIdx = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(startIdx, startIdx + limitNum);

    res.json({
      success: true,
      data: {
        products: paginated,
        pagination: {
          total: filtered.length,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(filtered.length / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/products/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const allProducts = await getCatalogProducts();
    const product = allProducts.find(
      (p) => String(p.id) === String(req.params.id)
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found.",
      });
    }

    res.json({
      success: true,
      data: { product },
    });
  } catch (err) {
    next(err);
  }
});

const createProductSchema = z.object({
  title: z.string().min(2).max(255),
  category: z.string().min(2).max(100),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  brand: z.string().optional(),
  description: z.string().min(5),
  thumbnail: z.string().url(),
});

/**
 * POST /api/v1/products (Admin/Staff Protected)
 */
router.post(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN", "STAFF"),
  async (req, res, next) => {
    try {
      const parsed = createProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: parsed.error.issues[0].message,
        });
      }

      const allProducts = await getCatalogProducts();
      const newProduct = {
        id: allProducts.length + 1000,
        ...parsed.data,
        reviews: [],
        dimensions: { width: 10, height: 10, depth: 5 },
      };

      catalogCache.products.unshift(newProduct);

      res.status(201).json({
        success: true,
        data: { product: newProduct },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
