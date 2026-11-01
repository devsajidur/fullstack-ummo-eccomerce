import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  applyRemoteStoreConfig,
  deleteContactMessageFromMongo,
  deleteSubscriberFromMongo,
  fetchCatalogProducts,
  fetchStoreDataFromMongo,
  getCustomAdminProducts,
  getDeletedProductIds,
  getStoredCoupons,
  invalidateCatalogCache,
  reconcileOrderPaymentInMongo,
  refundOrderPaymentInMongo,
  saveCustomAdminProducts,
  saveStoreConfigPatch,
  saveStoredCoupons,
  updateOrderStatusInMongo,
  updateUserRoleInMongo,
  verifyAdminSessionWithServer,
} from "../services/api";
import {
  authenticateAdminLogin,
  clearSessionUser,
  getLocalOrders,
  isUserAdmin,
  onUserChanged,
  saveAdminSessionToken,
  updateLocalOrderStatus,
} from "../services/authSession";
import { Allitem } from "../slices/AllProductSlice";
import { addProduct } from "../slices/productSlice";
import AdminOverviewTab from "../components/admin/AdminOverviewTab";
import AdminProductsTab from "../components/admin/AdminProductsTab";
import AdminCategoriesTab from "../components/admin/AdminCategoriesTab";
import AdminInventoryTab from "../components/admin/AdminInventoryTab";
import AdminDiscountsTab from "../components/admin/AdminDiscountsTab";
import AdminFeaturedCollectionTab from "../components/admin/AdminFeaturedCollectionTab";
import AdminOrdersTab from "../components/admin/AdminOrdersTab";
import AdminBannersTab from "../components/admin/AdminBannersTab";
import AdminCouponsTab from "../components/admin/AdminCouponsTab";
import AdminCustomersTab from "../components/admin/AdminCustomersTab";
import AdminSecurityTab from "../components/admin/AdminSecurityTab";
import {
  AdminForbiddenGate,
  AdminLoginPortal,
} from "../components/admin/shell/AdminAuthGates";
import AdminNavigationShell from "../components/admin/shell/AdminNavigationShell";
import {
  normalizeAdminProductSubmission,
  useAdminMetrics,
} from "../components/admin/shell/useAdminMetrics";

export default function AdminDashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const catalogProducts = useSelector((state) => state.AllProduct.Products);

  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState(() => getLocalOrders());
  const [customers, setCustomers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [coupons, setCoupons] = useState(() => getStoredCoupons());
  const [securityStatus, setSecurityStatus] = useState(null);

  const isAdminVerified = useMemo(() => isUserAdmin(authUser), [authUser]);
  const metrics = useAdminMetrics(orders, products, customers);

  useEffect(() => {
    const unsub = onUserChanged((user) => {
      setAuthUser(user || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser || !isAdminVerified) return undefined;
    let active = true;
    verifyAdminSessionWithServer()
      .then((res) => {
        if (!active) return;
        if (!res?.isAdmin) {
          saveAdminSessionToken("");
          setAuthUser((prev) => (prev ? { ...prev, role: "CUSTOMER" } : null));
        } else if (res?.securityStatus) {
          setSecurityStatus(res.securityStatus);
        }
      })
      .catch((err) => {
        if (!active) return;
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          saveAdminSessionToken("");
          setAuthUser((prev) => (prev ? { ...prev, role: "CUSTOMER" } : null));
        }
      });
    return () => {
      active = false;
    };
  }, [authUser, isAdminVerified]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e) => {
      if (e.key === "Escape") setMobileDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    if (catalogProducts?.length) {
      setProducts(catalogProducts);
    } else {
      fetchCatalogProducts(200).then((list) => {
        setProducts(list);
        dispatch(Allitem(list));
        dispatch(addProduct(list));
      });
    }
  }, [catalogProducts, dispatch]);

  useEffect(() => {
    if (!authUser || !isAdminVerified) return;

    let active = true;
    let initialConfigApplied = false;

    const syncMongoStoreData = () => {
      fetchStoreDataFromMongo()
        .then((data) => {
          if (!active || !data) return;

          const mongoOrders = Array.isArray(data.orders) ? data.orders : [];
          const localList = getLocalOrders();
          const mongoIds = new Set(mongoOrders.map((o) => String(o.orderId)));
          const mergedOrders = [
            ...mongoOrders,
            ...localList.filter((o) => !mongoIds.has(String(o.orderId))),
          ];
          mergedOrders.sort(
            (a, b) =>
              new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
          );
          setOrders(mergedOrders);

          if (Array.isArray(data.users)) setCustomers(data.users);
          if (Array.isArray(data.messages)) setMessages(data.messages);
          if (Array.isArray(data.subscribers)) setSubscribers(data.subscribers);

          if (!initialConfigApplied && data.storeConfig) {
            initialConfigApplied = true;
            applyRemoteStoreConfig(data.storeConfig);
            setCoupons(getStoredCoupons());
            fetchCatalogProducts(200).then((list) => {
              if (!active) return;
              setProducts(list);
              dispatch(Allitem(list));
              dispatch(addProduct(list));
            });
          }
        })
        .catch(() => {
          setOrders(getLocalOrders());
        });
    };

    syncMongoStoreData();
    const interval = setInterval(syncMongoStoreData, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [authUser, isAdminVerified, dispatch]);

  function handleUpdateProductDirect(updatedProduct) {
    if (!updatedProduct || !updatedProduct.id) return;
    const customList = getCustomAdminProducts();
    const nextCustom = [
      updatedProduct,
      ...customList.filter(
        (item) => String(item.id) !== String(updatedProduct.id)
      ),
    ];
    saveCustomAdminProducts(nextCustom);
    invalidateCatalogCache();

    const nextProducts = products.map((p) =>
      String(p.id) === String(updatedProduct.id)
        ? { ...p, ...updatedProduct }
        : p
    );
    setProducts(nextProducts);
    dispatch(Allitem(nextProducts));
    dispatch(addProduct(nextProducts));
  }

  function handleSaveProduct(arg1, arg2) {
    const customList = getCustomAdminProducts();
    const { payload, isEditing } = normalizeAdminProductSubmission(arg1, arg2);
    const nextCustom = [
      payload,
      ...customList.filter((item) => String(item.id) !== String(payload.id)),
    ];
    saveCustomAdminProducts(nextCustom);
    invalidateCatalogCache();

    const nextProducts = isEditing
      ? products.map((p) =>
          String(p.id) === String(payload.id) ? { ...p, ...payload } : p
        )
      : [
          payload,
          ...products.filter((p) => String(p.id) !== String(payload.id)),
        ];

    setProducts(nextProducts);
    dispatch(Allitem(nextProducts));
    dispatch(addProduct(nextProducts));
    toast.success(
      isEditing
        ? "Product updated in catalog!"
        : "New product published to catalog!"
    );
  }

  function handleDeleteProduct(product) {
    const idStr = String(product.id);
    const deletedIds = getDeletedProductIds();
    const isSeedId = Number(product.id) >= 1 && Number(product.id) <= 194;
    const nextDeleted = isSeedId
      ? [...new Set([...deletedIds.map(String), idStr])]
      : deletedIds.map(String).filter((id) => id !== idStr);
    const nextCustom = getCustomAdminProducts().filter(
      (p) => String(p.id) !== idStr
    );
    saveStoreConfigPatch({
      deletedIds: nextDeleted,
      customProducts: nextCustom,
    });
    invalidateCatalogCache();

    const nextProducts = products.filter((p) => String(p.id) !== idStr);
    setProducts(nextProducts);
    dispatch(Allitem(nextProducts));
    dispatch(addProduct(nextProducts));
    toast.success(`"${product.title}" removed from catalog.`);
  }

  async function handleResetCatalog() {
    await saveStoreConfigPatch({
      customProducts: [],
      deletedIds: [],
    });
    invalidateCatalogCache();
    const freshList = await fetchCatalogProducts(200);
    setProducts(freshList);
    dispatch(Allitem(freshList));
    dispatch(addProduct(freshList));
    toast.success("Catalog restored to default products!");
  }

  async function handleUpdateOrderStatus(order, newStatus) {
    const targetId = order.orderId || order.id;
    updateLocalOrderStatus(targetId, newStatus);
    setOrders((prev) =>
      prev.map((item) =>
        String(item.orderId || item.id) === String(targetId)
          ? { ...item, status: newStatus }
          : item
      )
    );
    await updateOrderStatusInMongo(targetId, newStatus).catch(() => {});
    toast.success(`Order #${String(targetId).slice(-6)} → ${newStatus}`);
  }

  async function handleReconcilePayment(
    orderId,
    targetPaymentStatus,
    reason = ""
  ) {
    setOrders((prev) =>
      prev.map((item) =>
        String(item.orderId || item.id) === String(orderId)
          ? {
              ...item,
              paymentStatus: targetPaymentStatus,
              status:
                targetPaymentStatus === "PAID" && item.status === "PENDING"
                  ? "PROCESSING"
                  : item.status,
            }
          : item
      )
    );
    try {
      const res = await reconcileOrderPaymentInMongo({
        orderId,
        targetPaymentStatus,
        reason,
      });
      if (res?.order) {
        setOrders((prev) =>
          prev.map((item) =>
            String(item.orderId || item.id) === String(orderId)
              ? { ...item, ...res.order }
              : item
          )
        );
      }
      toast.success(
        `Order #${String(orderId).slice(-6)} payment → ${targetPaymentStatus}`
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Payment reconciliation updated locally."
      );
    }
  }

  async function handleRefundPayment({
    orderId,
    refundAmount,
    reason,
    restockItems = false,
  }) {
    try {
      const res = await refundOrderPaymentInMongo({
        orderId,
        refundAmount,
        reason,
        restockItems,
      });
      if (res?.order) {
        setOrders((prev) =>
          prev.map((item) =>
            String(item.orderId || item.id) === String(orderId)
              ? { ...item, ...res.order }
              : item
          )
        );
      } else {
        setOrders((prev) =>
          prev.map((item) => {
            if (String(item.orderId || item.id) !== String(orderId)) return item;
            const total = Number(item.total ?? item.totalAmount ?? 0);
            const nextRefunded = Number(
              (Number(item.refundedAmount || 0) + Number(refundAmount)).toFixed(2)
            );
            const isFull = nextRefunded >= total - 0.01;
            return {
              ...item,
              paymentStatus: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
              refundedAmount: nextRefunded,
              status: isFull && restockItems ? "CANCELLED" : item.status,
            };
          })
        );
      }
      toast.success(
        `Refund ($${Number(refundAmount).toFixed(2)}) processed for Order #${String(orderId).slice(-6)}`
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to process refund.");
    }
  }

  function handleCreateCoupon(couponForm) {
    const cleanCode = couponForm.code.trim().toUpperCase();
    if (!cleanCode) return;
    const rawValue = Math.max(1, Number(couponForm.value) || 10);
    const safeValue =
      couponForm.type === "percentage" ? Math.min(90, rawValue) : rawValue;
    const next = [
      {
        code: cleanCode,
        type: couponForm.type,
        value: safeValue,
        minOrder: Math.max(0, Number(couponForm.minOrder) || 0),
        maxUsesPerUser: Math.max(1, Number(couponForm.maxUsesPerUser || 1)),
        maxTotalUses: Math.max(0, Number(couponForm.maxTotalUses || 0)),
        maxDiscountAmount: Math.max(
          0,
          Number(couponForm.maxDiscountAmount || 0)
        ),
        expiresAt: couponForm.expiresAt || "",
        description:
          couponForm.description.trim() ||
          `${safeValue}${couponForm.type === "percentage" ? "%" : "$"} discount`,
        active: true,
      },
      ...coupons.filter((c) => c.code !== cleanCode),
    ];
    setCoupons(next);
    saveStoredCoupons(next);
    toast.success(`Coupon ${cleanCode} created & published!`);
  }

  function handleToggleCoupon(code) {
    const next = coupons.map((c) =>
      c.code === code ? { ...c, active: c.active === false } : c
    );
    setCoupons(next);
    saveStoredCoupons(next);
    const updated = next.find((c) => c.code === code);
    toast.success(
      `Coupon ${code} is now ${updated?.active !== false ? "ACTIVE" : "PAUSED"}.`
    );
  }

  function handleDeleteCoupon(code) {
    const next = coupons.filter((c) => c.code !== code);
    setCoupons(next);
    saveStoredCoupons(next);
    toast.success(`Coupon ${code} deleted.`);
  }

  async function handleToggleUserRole(customer) {
    const nextRole = customer.role === "ADMIN" ? "CUSTOMER" : "ADMIN";
    setCustomers((prev) =>
      prev.map((c) => (c.uid === customer.uid ? { ...c, role: nextRole } : c))
    );
    try {
      await updateUserRoleInMongo(customer.uid, nextRole, {
        email: customer.email,
        username: customer.username || customer.name,
      });
      toast.success(`${customer.email || customer.username} is now ${nextRole}`);
    } catch {
      toast.error("Could not update user role in MongoDB.");
    }
  }

  async function handleDeleteMessage(msgId) {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      await deleteContactMessageFromMongo(msgId);
      toast.success("Inquiry message deleted.");
    } catch {
      toast.error("Could not delete message.");
    }
  }

  async function handleDeleteSubscriber(subId) {
    setSubscribers((prev) => prev.filter((s) => s.id !== subId));
    try {
      await deleteSubscriberFromMongo(subId);
      toast.success("Subscriber removed.");
    } catch {
      toast.error("Could not remove subscriber.");
    }
  }

  async function handleAdminSignIn(e) {
    e.preventDefault();
    setLoginError("");
    setLoginSubmitting(true);
    try {
      const verifiedAdmin = await authenticateAdminLogin(adminEmail, adminPass);
      setAuthUser(verifiedAdmin);
      setAdminPass("");
      toast.success("Authenticated as Administrator.");
    } catch (err) {
      const msg =
        err?.message || "Invalid administrator credentials. Access denied.";
      setLoginError(msg);
      toast.error(msg);
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleAdminSignOut() {
    setMobileDrawerOpen(false);
    await clearSessionUser();
    setAuthUser(null);
    toast.success("Signed out of Administrator Session.");
  }

  function handleSelectModule(moduleId) {
    setActiveTab(moduleId);
    setMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
        Verifying administrator session...
      </div>
    );
  }

  if (authUser && !isAdminVerified) {
    return (
      <AdminForbiddenGate
        authUser={authUser}
        onReturnStore={() => navigate("/")}
        onSignOut={handleAdminSignOut}
      />
    );
  }

  if (!authUser) {
    return (
      <AdminLoginPortal
        adminEmail={adminEmail}
        setAdminEmail={setAdminEmail}
        adminPass={adminPass}
        setAdminPass={setAdminPass}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        loginSubmitting={loginSubmitting}
        loginError={loginError}
        onSubmit={handleAdminSignIn}
        onReturnStore={() => navigate("/")}
      />
    );
  }

  return (
    <AdminNavigationShell
      authUser={authUser}
      activeTab={activeTab}
      metrics={metrics}
      mobileDrawerOpen={mobileDrawerOpen}
      setMobileDrawerOpen={setMobileDrawerOpen}
      onSelectModule={handleSelectModule}
      onNavigateStorefront={() => navigate("/")}
      onSignOut={handleAdminSignOut}
    >
      {activeTab === "overview" && (
        <AdminOverviewTab
          metrics={metrics}
          orders={orders}
          products={products}
          coupons={coupons}
          onNavigateTab={handleSelectModule}
          onUpdateOrderStatus={handleUpdateOrderStatus}
        />
      )}

      {activeTab === "products" && (
        <AdminProductsTab
          products={products}
          onSaveProduct={handleSaveProduct}
          onDeleteProduct={handleDeleteProduct}
          onResetCatalog={handleResetCatalog}
        />
      )}

      {activeTab === "featured" && (
        <AdminFeaturedCollectionTab products={products} />
      )}

      {activeTab === "categories" && (
        <AdminCategoriesTab
          products={products}
          onUpdateProduct={handleUpdateProductDirect}
        />
      )}

      {activeTab === "inventory" && (
        <AdminInventoryTab
          products={products}
          onUpdateProduct={handleUpdateProductDirect}
        />
      )}

      {activeTab === "discounts" && <AdminDiscountsTab products={products} />}

      {activeTab === "orders" && (
        <AdminOrdersTab
          orders={orders}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onReconcilePayment={handleReconcilePayment}
          onRefundPayment={handleRefundPayment}
          initialPaymentFilter="ALL"
        />
      )}

      {activeTab === "payments" && (
        <AdminOrdersTab
          orders={orders}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onReconcilePayment={handleReconcilePayment}
          onRefundPayment={handleRefundPayment}
          initialPaymentFilter="PAID"
        />
      )}

      {activeTab === "banners" && <AdminBannersTab />}

      {activeTab === "coupons" && (
        <AdminCouponsTab
          coupons={coupons}
          orders={orders}
          onCreateCoupon={handleCreateCoupon}
          onToggleCoupon={handleToggleCoupon}
          onDeleteCoupon={handleDeleteCoupon}
        />
      )}

      {activeTab === "customers" && (
        <AdminCustomersTab
          customers={customers}
          messages={messages}
          subscribers={subscribers}
          onToggleUserRole={handleToggleUserRole}
          onDeleteMessage={handleDeleteMessage}
          onDeleteSubscriber={handleDeleteSubscriber}
        />
      )}

      {activeTab === "security" && (
        <AdminSecurityTab
          authUser={authUser}
          securityStatus={securityStatus}
          onSecurityUpdated={(res) =>
            setSecurityStatus((prev) => ({
              ...(prev || {}),
              passwordConfiguredInDb: true,
              passwordConfigured: true,
              passwordUpdatedAt: res?.passwordUpdatedAt || new Date().toISOString(),
            }))
          }
          onSignOut={handleAdminSignOut}
        />
      )}
    </AdminNavigationShell>
  );
}
