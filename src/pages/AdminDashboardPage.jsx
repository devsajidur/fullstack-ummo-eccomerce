import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  limitToLast,
  onValue,
  query,
  ref,
  remove,
  update,
} from "firebase/database";
import { db } from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import {
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";
import {
  fetchCatalogProducts,
  getCustomAdminProducts,
  getDeletedProductIds,
  getStoredCoupons,
  invalidateCatalogCache,
  saveCustomAdminProducts,
  saveDeletedProductIds,
  saveStoredCoupons,
} from "../services/api";
import {
  clearSessionUser,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  getLocalOrders,
  onUserChanged,
  setSessionUser,
  signInAsDemoAdmin,
  updateLocalOrderStatus,
} from "../services/authSession";
import { Allitem } from "../slices/AllProductSlice";
import { addProduct } from "../slices/productSlice";
import AdminOverviewTab from "../components/admin/AdminOverviewTab";
import AdminProductsTab from "../components/admin/AdminProductsTab";
import AdminOrdersTab from "../components/admin/AdminOrdersTab";
import AdminBannersTab from "../components/admin/AdminBannersTab";
import AdminCouponsTab from "../components/admin/AdminCouponsTab";
import AdminCustomersTab from "../components/admin/AdminCustomersTab";

const ADMIN_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "banners", label: "Banners & CMS", icon: ImageIcon },
  { id: "coupons", label: "Promo Coupons", icon: Tag },
  { id: "customers", label: "Customers & Inbox", icon: Users },
];

export default function AdminDashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const catalogProducts = useSelector((state) => state.AllProduct.Products);

  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(
    () => localStorage.getItem("ummo_admin_unlocked") === "true"
  );

  // Direct Demo Admin Login form state
  const [adminEmail, setAdminEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [adminPass, setAdminPass] = useState(DEFAULT_ADMIN_PASSWORD);

  const [activeTab, setActiveTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState(() => getLocalOrders());
  const [customers, setCustomers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [coupons, setCoupons] = useState(() => getStoredCoupons());

  // 1. Verify Authentication & Admin Role
  useEffect(() => {
    const unsub = onUserChanged((user) => {
      setAuthUser(user || null);
      setAuthLoading(false);
      if (user) {
        if (
          user.role === "ADMIN" ||
          user.role === "SUPER_ADMIN" ||
          user.email?.toLowerCase().includes("admin") ||
          localStorage.getItem("ummo_admin_unlocked") === "true"
        ) {
          setIsAdminVerified(true);
        } else {
          onValue(
            ref(db, `users/${user.uid}`),
            (snap) => {
              const val = snap.val();
              if (val?.role === "ADMIN" || val?.role === "SUPER_ADMIN") {
                setIsAdminVerified(true);
              }
            },
            { onlyOnce: true }
          );
        }
      }
    });
    return () => unsub();
  }, []);

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

  // 3. Real-time Firebase Listeners for Orders, Customers, Messages, Subscribers & Coupons
  useEffect(() => {
    if (!authUser || !isAdminVerified) return;

    const unsubOrders = onValue(
      query(ref(db, "orders"), limitToLast(100)),
      (snapshot) => {
        const fbOrders = [];
        if (snapshot.exists()) {
          Object.entries(snapshot.val()).forEach(([userUid, userOrders]) => {
            if (userOrders && typeof userOrders === "object") {
              Object.entries(userOrders).forEach(([orderId, orderData]) => {
                fbOrders.push({
                  orderId,
                  userUid,
                  ...orderData,
                  status: orderData.status || "PENDING",
                });
              });
            }
          });
        }
        const localList = getLocalOrders();
        const fbIds = new Set(fbOrders.map((o) => String(o.orderId)));
        const merged = [
          ...fbOrders,
          ...localList.filter((o) => !fbIds.has(String(o.orderId))),
        ];
        merged.sort(
          (a, b) =>
            new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );
        setOrders(merged);
      },
      () => {
        setOrders(getLocalOrders());
      }
    );

    const unsubUsers = onValue(
      query(ref(db, "users"), limitToLast(100)),
      (snapshot) => {
        if (!snapshot.exists()) {
          setCustomers([]);
          return;
        }
        setCustomers(
          Object.entries(snapshot.val()).map(([uid, data]) => ({
            uid,
            ...data,
          }))
        );
      }
    );

    const unsubMessages = onValue(
      query(ref(db, "messages"), limitToLast(50)),
      (snapshot) => {
        if (!snapshot.exists()) {
          setMessages([]);
          return;
        }
        setMessages(
          Object.entries(snapshot.val())
            .map(([id, data]) => ({ id, ...data }))
            .reverse()
        );
      }
    );

    const unsubSubscribers = onValue(
      query(ref(db, "subscribers"), limitToLast(100)),
      (snapshot) => {
        if (!snapshot.exists()) {
          setSubscribers([]);
          return;
        }
        setSubscribers(
          Object.entries(snapshot.val())
            .map(([id, data]) => ({ id, ...data }))
            .reverse()
        );
      }
    );

    const unsubCoupons = onValue(ref(db, "storeConfig/coupons"), (snapshot) => {
      if (snapshot.exists() && Array.isArray(snapshot.val())) {
        setCoupons(snapshot.val());
        localStorage.setItem(
          "ummo_admin_coupons",
          JSON.stringify(snapshot.val())
        );
      }
    });

    return () => {
      unsubOrders();
      unsubUsers();
      unsubMessages();
      unsubSubscribers();
      unsubCoupons();
    };
  }, [authUser, isAdminVerified]);

  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELLED");
    const totalRevenue = validOrders.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );
    const avgOrderValue =
      validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
    const pendingOrders = orders.filter(
      (o) => (o.status || "PENDING") === "PENDING"
    ).length;
    const lowStockProducts = products.filter(
      (p) => Number(p.stock ?? 20) < 10
    ).length;

    return {
      totalRevenue,
      avgOrderValue,
      totalOrders: orders.length,
      pendingOrders,
      totalProducts: products.length,
      lowStockProducts,
      totalCustomers: customers.length,
    };
  }, [orders, products, customers]);

  function handleSaveProduct(editingProduct, productForm) {
    const customList = getCustomAdminProducts();
    const cleanThumb = productForm.thumbnail.trim();
    const freeGift =
      productForm.freeGiftEnabled && String(productForm.freeGiftName || "").trim()
        ? {
            enabled: true,
            minBuyQty: Math.max(1, Number(productForm.freeGiftMinBuyQty) || 1),
            giftName: String(productForm.freeGiftName).trim(),
            giftQty: Math.max(1, Number(productForm.freeGiftQty) || 1),
            giftImage: String(productForm.freeGiftImage || "").trim(),
            giftProductId: productForm.freeGiftProductId || "",
          }
        : { enabled: false };

    const payload = {
      id: editingProduct ? editingProduct.id : Date.now(),
      title: productForm.title.trim(),
      category: productForm.category.trim(),
      brand: productForm.brand.trim() || "UOMO",
      price: Number(productForm.price) || 29.99,
      discountPercentage: Number(productForm.discountPercentage) || 0,
      discountEndTime: productForm.discountEndTime || "none",
      freeGift,
      stock: Number(productForm.stock) || 0,
      sku: productForm.sku.trim() || `UMMO-${Date.now()}`,
      thumbnail: cleanThumb,
      images: editingProduct?.images?.length
        ? [cleanThumb, ...editingProduct.images.slice(1)]
        : [cleanThumb],
      description: productForm.description.trim(),
      rating: editingProduct?.rating || 4.8,
      isCustomNew: !editingProduct || Boolean(editingProduct.isCustomNew),
    };

    const nextCustom = [
      payload,
      ...customList.filter((item) => String(item.id) !== String(payload.id)),
    ];
    saveCustomAdminProducts(nextCustom);
    invalidateCatalogCache();

    const nextProducts = editingProduct
      ? products.map((p) =>
          String(p.id) === String(payload.id) ? { ...p, ...payload } : p
        )
      : [payload, ...products];

    setProducts(nextProducts);
    dispatch(Allitem(nextProducts));
    dispatch(addProduct(nextProducts));
    toast.success(
      editingProduct
        ? "Product & discount timer updated live!"
        : "New product added to store!"
    );
  }

  function handleApplyBulkFlashSale(discountPercent, durationHours) {
    const endTimeIso = new Date(
      Date.now() + Number(durationHours || 24) * 3600 * 1000
    ).toISOString();
    const customList = getCustomAdminProducts();
    const customMap = new Map(customList.map((item) => [String(item.id), item]));

    // Apply flash sale timer to the top 16 storefront products
    const updatedProducts = products.map((prod, idx) => {
      if (idx >= 16) return prod;
      const updated = {
        ...prod,
        discountPercentage: Number(discountPercent) || 20,
        discountEndTime: endTimeIso,
      };
      customMap.set(String(prod.id), updated);
      return updated;
    });

    saveCustomAdminProducts(Array.from(customMap.values()));
    invalidateCatalogCache();
    setProducts(updatedProducts);
    dispatch(Allitem(updatedProducts));
    dispatch(addProduct(updatedProducts));
    toast.success(
      `Flash Sale (${discountPercent}% OFF for ${durationHours}h) activated across featured products!`
    );
  }

  function handleDeleteProduct(product) {
    const deletedIds = getDeletedProductIds();
    const nextDeleted = [...new Set([...deletedIds, String(product.id)])];
    saveDeletedProductIds(nextDeleted);
    invalidateCatalogCache();

    const nextProducts = products.filter(
      (p) => String(p.id) !== String(product.id)
    );
    setProducts(nextProducts);
    dispatch(Allitem(nextProducts));
    dispatch(addProduct(nextProducts));
    toast.success(`"${product.title}" removed from catalog.`);
  }

  async function handleResetCatalog() {
    saveCustomAdminProducts([]);
    saveDeletedProductIds([]);
    invalidateCatalogCache();
    const freshList = await fetchCatalogProducts(200);
    setProducts(freshList);
    dispatch(Allitem(freshList));
    dispatch(addProduct(freshList));
    toast.success("Catalog restored to default products!");
  }

  async function handleUpdateOrderStatus(order, newStatus) {
    updateLocalOrderStatus(order.orderId, newStatus);
    setOrders((prev) =>
      prev.map((item) =>
        String(item.orderId) === String(order.orderId)
          ? { ...item, status: newStatus }
          : item
      )
    );
    try {
      await update(ref(db, `orders/${order.userUid}/${order.orderId}`), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Local order updated above
    }
    toast.success(`Order #${String(order.orderId).slice(-6)} → ${newStatus}`);
  }

  function handleCreateCoupon(couponForm) {
    const cleanCode = couponForm.code.trim().toUpperCase();
    if (!cleanCode) return;
    const next = [
      {
        code: cleanCode,
        type: couponForm.type,
        value: Number(couponForm.value) || 10,
        minOrder: Number(couponForm.minOrder) || 0,
        description:
          couponForm.description.trim() ||
          `${couponForm.value}${
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
      await update(ref(db, `users/${customer.uid}`), { role: nextRole });
      toast.success(`${customer.email || customer.username} is now ${nextRole}`);
    } catch {
      toast.error("Could not update user role in database.");
    }
  }

  async function handleDeleteMessage(msgId) {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      await remove(ref(db, `messages/${msgId}`));
      toast.success("Inquiry message deleted.");
    } catch {
      toast.error("Could not delete message.");
    }
  }

  async function handleDeleteSubscriber(subId) {
    setSubscribers((prev) => prev.filter((s) => s.id !== subId));
    try {
      await remove(ref(db, `subscribers/${subId}`));
      toast.success("Subscriber removed.");
    } catch {
      toast.error("Could not remove subscriber.");
    }
  }

  async function handleDirectAdminLogin(e) {
    e.preventDefault();
    if (
      adminEmail.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL &&
      adminPass === DEFAULT_ADMIN_PASSWORD
    ) {
      const adminUser = await signInAsDemoAdmin();
      setAuthUser(adminUser);
      setIsAdminVerified(true);
      toast.success("Welcome to the UOMO Admin Control Center!");
    } else {
      toast.error(
        `Use Demo Admin Email: ${DEFAULT_ADMIN_EMAIL} & Password: ${DEFAULT_ADMIN_PASSWORD}`
      );
    }
  }

  async function handleActivateAdminRole() {
    if (authUser && authUser.email !== DEFAULT_ADMIN_EMAIL) {
      localStorage.setItem("ummo_admin_unlocked", "true");
      const elevated = { ...authUser, role: "ADMIN" };
      setSessionUser(elevated);
      setAuthUser(elevated);
      setIsAdminVerified(true);
      await update(ref(db, `users/${authUser.uid}`), { role: "ADMIN" }).catch(
        () => {}
      );
      toast.success("Admin role activated!");
    } else {
      const adminUser = await signInAsDemoAdmin();
      setAuthUser(adminUser);
      setIsAdminVerified(true);
      toast.success("Logged into Demo Admin Control Center!");
    }
  }

  async function handleAdminSignOut() {
    setIsAdminVerified(false);
    await clearSessionUser();
    toast.success("Signed out of Admin Panel.");
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">
        Verifying admin session...
      </div>
    );
  }

  // Security Gate: Built-in Demo Admin Login Portal right on /admin
  if (!authUser || !isAdminVerified) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 bg-gray-50">
        <Toaster position="top-right" />
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto mb-4">
            <Lock size={20} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 text-center">
            Admin Control Center Login
          </h1>
          <p className="text-xs text-gray-500 text-center mt-1 mb-5">
            Sign in with the Demo Admin credentials or use 1-Click Demo Admin Login below.
          </p>

          <form
            onSubmit={handleDirectAdminLogin}
            className="space-y-4 text-left"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Admin Password
              </label>
              <input
                type="password"
                required
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
              />
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-[11px] text-gray-600">
              Demo Admin: <strong className="font-mono">{DEFAULT_ADMIN_EMAIL}</strong> /{" "}
              <strong className="font-mono">{DEFAULT_ADMIN_PASSWORD}</strong>
            </div>
            <button
              type="submit"
              className="w-full bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider py-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
            >
              Sign In to Admin Panel
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleActivateAdminRole}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wider py-3 rounded-lg hover:bg-emerald-700 cursor-pointer transition-colors"
            >
              <ShieldCheck size={16} /> 1-Click Demo Admin Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <Toaster position="top-right" />
      <div className="container mx-auto max-w-7xl">
        {/* Top Bar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              <ShieldCheck size={13} /> Enterprise Admin Control Center
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
              Storefront, Catalog, Orders & Banner CMS
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/shop")}
              className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              View Live Storefront <ExternalLink size={13} />
            </button>
            <button
              type="button"
              onClick={handleAdminSignOut}
              className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-red-50 cursor-pointer"
            >
              <LogOut size={13} /> Sign Out Admin
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Active Tab Content */}
        {activeTab === "overview" && (
          <AdminOverviewTab
            metrics={metrics}
            orders={orders}
            coupons={coupons}
            onNavigateTab={setActiveTab}
            onUpdateOrderStatus={handleUpdateOrderStatus}
          />
        )}
        {activeTab === "products" && (
          <AdminProductsTab
            products={products}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onResetCatalog={handleResetCatalog}
            onApplyBulkFlashSale={handleApplyBulkFlashSale}
          />
        )}
        {activeTab === "orders" && (
          <AdminOrdersTab
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
          />
        )}
        {activeTab === "banners" && <AdminBannersTab />}
        {activeTab === "coupons" && (
          <AdminCouponsTab
            coupons={coupons}
            onCreateCoupon={handleCreateCoupon}
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
      </div>
    </div>
  );
}
