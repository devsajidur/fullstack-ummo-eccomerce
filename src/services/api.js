import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export const DEFAULT_COUPONS = [
  {
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    minOrder: 30,
    description: "10% off on orders above $30",
    active: true,
  },
  {
    code: "UMMO20",
    type: "fixed",
    value: 20,
    minOrder: 100,
    description: "$20 flat discount on orders above $100",
    active: true,
  },
  {
    code: "VIP25",
    type: "percentage",
    value: 25,
    minOrder: 200,
    description: "25% VIP discount on orders above $200",
    active: true,
  },
];

export function getStoredCoupons() {
  try {
    const saved = localStorage.getItem("ummo_admin_coupons");
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  localStorage.setItem("ummo_admin_coupons", JSON.stringify(DEFAULT_COUPONS));
  return DEFAULT_COUPONS;
}

export function saveStoredCoupons(coupons) {
  localStorage.setItem("ummo_admin_coupons", JSON.stringify(coupons));
}

export function getCustomAdminProducts() {
  try {
    const saved = localStorage.getItem("ummo_admin_custom_products");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveCustomAdminProducts(products) {
  localStorage.setItem("ummo_admin_custom_products", JSON.stringify(products));
}

export function getDeletedProductIds() {
  try {
    const saved = localStorage.getItem("ummo_admin_deleted_ids");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveDeletedProductIds(ids) {
  localStorage.setItem("ummo_admin_deleted_ids", JSON.stringify(ids));
}

function mergeWithAdminCatalog(baseProducts) {
  const customProducts = getCustomAdminProducts();
  const deletedIds = new Set(getDeletedProductIds().map(String));

  const customMap = new Map(customProducts.map((p) => [String(p.id), p]));
  const merged = [];

  // First include newly added custom products at the top
  for (const cp of customProducts) {
    if (!deletedIds.has(String(cp.id)) && cp.isCustomNew) {
      merged.push(cp);
    }
  }

  // Merge overrides and filter deleted items from base catalog
  for (const item of baseProducts) {
    const idStr = String(item.id);
    if (deletedIds.has(idStr)) continue;
    if (customMap.has(idStr)) {
      merged.push({ ...item, ...customMap.get(idStr) });
    } else {
      merged.push(item);
    }
  }

  return merged;
}

/**
 * Fetches the product catalog from the Enterprise Backend API,
 * with automatic fallback to DummyJSON and merges Admin Panel customizations.
 */
export async function fetchCatalogProducts(limit = 200) {
  try {
    const response = await apiClient.get(`/products?limit=${limit}`);
    if (response.data?.data?.products?.length) {
      return mergeWithAdminCatalog(response.data.data.products);
    }
  } catch {
    // Fallback to DummyJSON when standalone frontend is used without local backend running
  }
  const fallback = await axios.get(
    `https://dummyjson.com/products?limit=${limit}`
  );
  return mergeWithAdminCatalog(fallback.data?.products || []);
}

/**
 * Submits an order to the Enterprise Backend API (server-side price & stock verification)
 */
export async function submitBackendOrder(orderPayload) {
  const response = await apiClient.post("/orders/checkout", orderPayload, {
    headers: {
      "Idempotency-Key": crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`,
    },
  });
  return response.data;
}
