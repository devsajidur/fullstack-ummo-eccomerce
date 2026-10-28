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

// Attach in-memory or session access token if present
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

/**
 * Fetches the product catalog from the Enterprise Backend API,
 * with automatic fallback to DummyJSON so Vercel/static previews always work.
 */
export async function fetchCatalogProducts(limit = 200) {
  try {
    const response = await apiClient.get(`/products?limit=${limit}`);
    if (response.data?.data?.products?.length) {
      return response.data.data.products;
    }
  } catch {
    // Fallback to DummyJSON when standalone frontend is used without local backend running
  }
  const fallback = await axios.get(
    `https://dummyjson.com/products?limit=${limit}`
  );
  return fallback.data?.products || [];
}

/**
 * Submits an order to the Enterprise Backend API (server-side price & stock verification)
 */
export async function submitBackendOrder(orderPayload) {
  const response = await apiClient.post("/orders/checkout", orderPayload, {
    headers: {
      "Idempotency-Key": crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    },
  });
  return response.data;
}
