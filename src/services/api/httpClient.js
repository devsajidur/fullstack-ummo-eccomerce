import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
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
  try {
    if (typeof localStorage !== "undefined") {
      const rawUser = localStorage.getItem("ummo_active_user");
      const activeUser = rawUser ? JSON.parse(rawUser) : null;
      const adminToken =
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("ummo_admin_session_token")) ||
        localStorage.getItem("ummo_admin_session_token") ||
        "";
      if (activeUser?.uid) {
        config.headers["X-User-Uid"] = String(activeUser.uid);
      }
      if (activeUser?.email) {
        config.headers["X-User-Email"] = String(activeUser.email);
      }
      const isCustomerSession =
        activeUser &&
        String(activeUser.role || "").toUpperCase() !== "ADMIN";
      if (adminToken && !isCustomerSession) {
        config.headers["X-Admin-Token"] = adminToken;
      }
    }
  } catch {
    // ignore storage access errors
  }
  return config;
});

export async function loginAdminWithServer(email, password) {
  const response = await apiClient.post("/admin/login", { email, password });
  return response.data;
}

export async function logoutAdminWithServer() {
  const response = await apiClient.post("/admin/logout");
  return response.data;
}

export async function verifyAdminSessionWithServer() {
  const response = await apiClient.get("/admin/session");
  return response.data;
}

export async function changeAdminPasswordWithServer(
  currentPassword,
  newPassword
) {
  const response = await apiClient.post("/admin/password", {
    currentPassword,
    newPassword,
  });
  return response.data;
}
