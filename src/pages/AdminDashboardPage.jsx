import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import toast, { Toaster } from "react-hot-toast";
import {
  Archive,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  FolderTree,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Package,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
  X,
} from "lucide-react";
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
import { useLocalization } from "../i18n/LocalizationContext";
import AdminOverviewTab from "../components/admin/AdminOverviewTab";
import AdminProductsTab from "../components/admin/AdminProductsTab";
import AdminCategoriesTab from "../components/admin/AdminCategoriesTab";
import AdminInventoryTab from "../components/admin/AdminInventoryTab";
import AdminDiscountsTab from "../components/admin/AdminDiscountsTab";
import AdminOrdersTab from "../components/admin/AdminOrdersTab";
import AdminBannersTab from "../components/admin/AdminBannersTab";
import AdminCouponsTab from "../components/admin/AdminCouponsTab";
import AdminCustomersTab from "../components/admin/AdminCustomersTab";

const ADMIN_MODULES = [
  { id: "overview", label: "Overview", labelBn: "ওভারভিউ", icon: LayoutDashboard },
  { id: "orders", label: "Orders", labelBn: "অর্ডারসমূহ", icon: ShoppingCart },
  { id: "products", label: "Products", labelBn: "পণ্যসমূহ", icon: Package },
  { id: "categories", label: "Categories", labelBn: "ক্যাটাগরি", icon: FolderTree },
  { id: "inventory", label: "Inventory", labelBn: "ইনভেন্টরি", icon: Archive },
  { id: "discounts", label: "Discounts", labelBn: "ডিসকাউন্ট", icon: Flame },
  { id: "coupons", label: "Coupons", labelBn: "কুপন", icon: Tag },
  { id: "customers", label: "Customers", labelBn: "গ্রাহকবৃন্দ", icon: Users },
  {
    id: "payments",
    label: "Payments & Refunds",
    labelBn: "পেমেন্ট ও রিফান্ড",
    icon: CreditCard,
  },
  { id: "banners", label: "Banners & CMS", labelBn: "ব্যানার ও সিএমএস", icon: ImageIcon },
];

export default function AdminDashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLocalization();
  const catalogProducts = useSelector((state) => state.AllProduct.Products);

  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Dedicated Admin Sign-In form state (never pre-filled with demo credentials)
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Mobile navigation drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState(() => getLocalOrders());
  const [customers, setCustomers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [coupons, setCoupons] = useState(() => getStoredCoupons());

  const isAdminVerified = useMemo(() => isUserAdmin(authUser), [authUser]);

  // 1. Verify Authentication & Admin Role (Client + Authoritative Server Session Check)
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

  // Lock body scroll when mobile admin drawer is open & close on Escape
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

  // 2. Load Catalog Products
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

  // 3. Load & Sync Orders, Customers, Messages, Subscribers & StoreConfig from MongoDB Atlas
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

          if (Array.isArray(data.users)) {
            setCustomers(data.users);
          }
          if (Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
          if (Array.isArray(data.subscribers)) {
            setSubscribers(data.subscribers);
          }

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

  const metrics = useMemo(() => {
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

    const sizesList = Array.isArray(productForm.sizes)
      ? productForm.sizes
      : String(productForm.sizesInput || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    const colorsList = Array.isArray(productForm.colors)
      ? productForm.colors
      : String(productForm.colorsInput || "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);

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
    const payload = {
      id: productForm.id || (editingProduct ? editingProduct.id : Date.now()),
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
      sku: String(productForm.sku || "").trim() || `UMMO-${Date.now()}`,
      thumbnail: mergedGallery[0] || cleanThumb,
      images: mergedGallery.length ? mergedGallery : [cleanThumb].filter(Boolean),
      sizes: sizesList,
      colors: colorsList,
      isVisible,
      isFeatured: Boolean(productForm.isFeatured),
      status: isVisible ? "active" : "draft",
      description: String(productForm.description || "").trim(),
      rating: productForm.rating || editingProduct?.rating || 4.8,
      isCustomNew: !isEditing || Boolean(productForm.isCustomNew || editingProduct?.isCustomNew),
    };

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
      : [payload, ...products.filter((p) => String(p.id) !== String(payload.id))];

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
          `${safeValue}${
            couponForm.type === "percentage" ? "%" : "$"
          } discount`,
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

  // ============================================================================
  // GATE 2B: Authenticated Non-Admin User -> 403 Access Denied
  // ============================================================================
  if (authUser && !isAdminVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
        <Toaster position="top-right" />
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={22} />
          </div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-widest bg-red-100 text-red-800 px-3 py-0.5 rounded-full mb-2">
            HTTP 403 • Access Denied
          </span>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">
            Administrator Privileges Required
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-2">
            You are currently signed in as{" "}
            <strong className="text-gray-900">{authUser.email}</strong> (Role:{" "}
            <span className="font-mono font-semibold">
              {authUser.role || "CUSTOMER"}
            </span>
            ). This account does not have permission to access the UOMO
            Administration Portal.
          </p>

          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider py-3 rounded-xl hover:bg-gray-800 cursor-pointer transition-colors"
            >
              Return to Storefront
            </button>
            <button
              type="button"
              onClick={handleAdminSignOut}
              className="w-full border border-gray-300 text-gray-700 text-xs font-semibold uppercase tracking-wider py-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
            >
              Sign Out & Switch to Admin Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // GATE 2A: Unauthenticated User -> Dedicated Administrator Sign-In Portal
  // ============================================================================
  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-950">
        <Toaster position="top-right" />
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <span className="text-lg font-black tracking-tight text-gray-900">
              UOMO <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Admin</span>
            </span>
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1 cursor-pointer"
            >
              <Globe size={13} />
              {language === "bn" ? "English" : "বাংলা"}
            </button>
          </div>

          <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center mb-4">
            <Lock size={20} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {language === "bn"
              ? "অ্যাডমিন পোর্টাল সাইন ইন"
              : "Administrator Sign In"}
          </h1>
          <p className="text-xs text-gray-500 mt-1 mb-6">
            {language === "bn"
              ? "শুধুমাত্র অনুমোদিত অ্যাডমিনিস্ট্রেটরদের জন্য। আপনার অ্যাডমিন ইমেইল এবং পাসওয়ার্ড দিন।"
              : "Restricted portal. Enter your authorized administrator credentials to continue."}
          </p>

          {loginError && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-4 text-left">
            <div>
              <label
                htmlFor="admin-login-email"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                {language === "bn" ? "অ্যাডমিন ইমেইল" : "Administrator Email"}
              </label>
              <input
                id="admin-login-email"
                type="email"
                required
                autoComplete="username"
                placeholder="admin@domain.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
              />
            </div>

            <div>
              <label
                htmlFor="admin-login-password"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                {language === "bn" ? "পাসওয়ার্ড" : "Password"}
              </label>
              <div className="relative">
                <input
                  id="admin-login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl pl-3.5 pr-10 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider py-3.5 rounded-xl hover:bg-gray-800 disabled:opacity-60 cursor-pointer transition-colors"
            >
              {loginSubmitting
                ? language === "bn"
                  ? "যাচাই করা হচ্ছে..."
                  : "Verifying Credentials..."
                : language === "bn"
                ? "অ্যাডমিন প্যানেলে প্রবেশ করুন"
                : "Sign In to Admin Portal"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 cursor-pointer"
            >
              ← {language === "bn" ? "স্টোরফ্রন্টে ফিরে যান" : "Return to Storefront"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // GATE 3: Mobile-First Admin Control Center Shell
  // ============================================================================
  const activeModuleObj =
    ADMIN_MODULES.find((m) => m.id === activeTab) || ADMIN_MODULES[0];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-right" />

      {/* Sticky Top Header (Mobile + Desktop) */}
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Open admin navigation drawer"
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-gray-900">
                UOMO
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                <ShieldCheck size={11} /> Admin
              </span>
            </div>
            <p className="text-[11px] text-gray-500 truncate">
              {language === "bn" ? activeModuleObj.labelBn : activeModuleObj.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1 border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-2 rounded-xl hover:bg-gray-50 cursor-pointer"
          >
            <Globe size={13} />
            <span>{language === "bn" ? "EN" : "বাংলা"}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer"
          >
            <span className="hidden sm:inline">
              {language === "bn" ? "স্টোরফ্রন্ট" : "Storefront"}
            </span>
            <ExternalLink size={13} />
          </button>

          <button
            type="button"
            onClick={handleAdminSignOut}
            className="hidden sm:inline-flex items-center gap-1.5 border border-red-200 text-red-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-red-50 cursor-pointer"
          >
            <LogOut size={13} />
            <span>{language === "bn" ? "লগআউট" : "Logout"}</span>
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Navigation Drawer (< 1024px) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            aria-hidden="true"
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          />
          <aside
            aria-label="Mobile Admin Navigation"
            className="relative z-10 w-[84vw] max-w-[300px] h-[100dvh] bg-white shadow-2xl flex flex-col justify-between overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  UOMO Admin Portal
                </p>
                <p className="text-[11px] text-gray-500 truncate max-w-[200px]">
                  {authUser.email}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close admin navigation drawer"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              {ADMIN_MODULES.map((mod) => {
                const Icon = mod.icon;
                const active = activeTab === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelectModule(mod.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? "bg-gray-900 text-white shadow-xs"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={16} />
                      {language === "bn" ? mod.labelBn : mod.label}
                    </span>
                    {mod.id === "orders" && metrics.pendingOrders > 0 && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          active
                            ? "bg-white text-gray-900"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {metrics.pendingOrders}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-gray-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  navigate("/");
                }}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                <ExternalLink size={14} />
                {language === "bn" ? "স্টোরফ্রন্ট দেখুন" : "View Storefront"}
              </button>
              <button
                type="button"
                onClick={handleAdminSignOut}
                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold py-2.5 rounded-xl hover:bg-red-100 cursor-pointer"
              >
                <LogOut size={14} />
                {language === "bn" ? "অ্যাডমিন লগআউট" : "Sign Out Admin"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Layout: Desktop Left Sidebar + Responsive Content Area */}
      <div className="flex-1 flex container mx-auto max-w-7xl w-full px-3 sm:px-6 py-4 sm:py-6 gap-6">
        {/* Desktop Sidebar (>= 1024px) */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0">
          <div className="bg-white border border-gray-200 rounded-2xl p-3 sticky top-22 space-y-1 shadow-xs">
            <div className="px-3 py-2 border-b border-gray-100 mb-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {language === "bn" ? "ম্যানেজমেন্ট মডিউল" : "Admin Modules"}
              </p>
              <p className="text-xs font-semibold text-gray-800 truncate mt-0.5">
                {authUser.email}
              </p>
            </div>

            {ADMIN_MODULES.map((mod) => {
              const Icon = mod.icon;
              const active = activeTab === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleSelectModule(mod.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-gray-900 text-white shadow-xs"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={15} />
                    {language === "bn" ? mod.labelBn : mod.label}
                  </span>
                  {mod.id === "orders" && metrics.pendingOrders > 0 && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        active
                          ? "bg-white text-gray-900"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {metrics.pendingOrders}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Module Content */}
        <main className="flex-1 min-w-0">
          {/* Mobile Horizontal Quick-Switch Bar (< 1024px) */}
          <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-3 mb-3">
            {ADMIN_MODULES.map((mod) => {
              const Icon = mod.icon;
              const active = activeTab === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleSelectModule(mod.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer border ${
                    active
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  <Icon size={13} />
                  {language === "bn" ? mod.labelBn : mod.label}
                </button>
              );
            })}
          </div>

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

          {activeTab === "discounts" && (
            <AdminDiscountsTab products={products} />
          )}

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
        </main>
      </div>
    </div>
  );
}
