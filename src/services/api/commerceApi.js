import { apiClient } from "./httpClient";

export async function fetchStoreDataFromMongo(params = {}) {
  const response = await apiClient.get("/store-data", { params });
  return response.data;
}

export async function submitBackendOrder(orderPayload) {
  const response = await apiClient.post("/orders", orderPayload, {
    headers: {
      "Idempotency-Key": crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`,
    },
  });
  return response.data;
}

export async function fetchPaymentGatewaysConfig() {
  const response = await apiClient.get("/payments/config");
  return response.data;
}

export async function initiatePaymentSession(orderId, gateway = "sslcommerz") {
  const originUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:5173";
  if (gateway === "stripe") {
    const response = await apiClient.post("/payments/stripe/create-session", {
      orderId,
      originUrl,
    });
    return response.data;
  }
  const response = await apiClient.post("/payments/sslcommerz/init", {
    orderId,
    originUrl,
  });
  return response.data;
}

export async function confirmSandboxPayment(payload) {
  const response = await apiClient.post("/payments/sandbox-confirm", payload);
  return response.data;
}

export async function reconcileOrderPaymentInMongo(payload) {
  const response = await apiClient.post("/payments/reconcile", payload);
  return response.data;
}

export async function refundOrderPaymentInMongo(payload) {
  const response = await apiClient.post("/payments/refund", payload);
  return response.data;
}

export async function updateOrderStatusInMongo(
  orderId,
  statusOrUid,
  maybeStatus
) {
  const status = maybeStatus !== undefined ? maybeStatus : statusOrUid;
  const response = await apiClient.patch("/orders/status", { orderId, status });
  return response.data;
}

export async function syncUserToMongo(userPayload) {
  const response = await apiClient.post("/users", userPayload);
  return response.data;
}

export async function updateUserRoleInMongo(uid, role, extra = {}) {
  const response = await apiClient.patch("/users/role", {
    uid,
    role,
    ...extra,
  });
  return response.data;
}

export async function fetchUserAddressesFromMongo(userUid) {
  const response = await apiClient.get("/addresses", { params: { userUid } });
  return response.data?.addresses || [];
}

export async function saveUserAddressesToMongo(userUid, addresses) {
  const response = await apiClient.post("/addresses", { userUid, addresses });
  return response.data?.addresses || [];
}

export async function fetchProductReviewsFromMongo(productId) {
  const response = await apiClient.get("/reviews", { params: { productId } });
  return response.data?.reviews || [];
}

export async function saveProductReviewToMongo(productId, review) {
  const response = await apiClient.post("/reviews", { productId, review });
  return response.data?.reviews || [];
}

export async function submitContactMessageToMongo(messagePayload) {
  const response = await apiClient.post("/messages", messagePayload);
  return response.data;
}

export async function deleteContactMessageFromMongo(id) {
  const response = await apiClient.delete("/messages", { params: { id } });
  return response.data;
}

export async function submitSubscriberToMongo(email) {
  const response = await apiClient.post("/subscribers", { email });
  return response.data;
}

export async function deleteSubscriberFromMongo(id) {
  const response = await apiClient.delete("/subscribers", { params: { id } });
  return response.data;
}
