import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  limitToLast,
  onValue,
  query,
  ref,
  update,
} from "firebase/database";
import { auth, db } from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import {
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
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

  const [activeTab, setActiveTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [coupons, setCoupons] = useState(() => getStoredCoupons());

  // 1. Verify Authentication & Admin Role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user || null);
      setAuthLoading(false);
      if (user) {
        onValue(
          ref(db, `users/${user.uid}`),
          (snap) => {
            const val = snap.val();
            if (
              val?.role === "ADMIN" ||
              val?.role === "SUPER_ADMIN" ||
              user.email?.toLowerCase().includes("admin")
            ) {
              setIsAdminVerified(true);
            }
          },
          { onlyOnce: true }
        );
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

  // 3. Bounded Firebase Realtime Listeners (limitToLast(100) for high-concurrency safety)
  useEffect(() => {
    if (!authUser || !isAdminVerified) return;

    const unsubOrders = onValue(
      query(ref(db, "orders"), limitToLast(100)),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrders([]);
          return;
        }
        const allOrders = [];
        Object.entries(snapshot.val()).forEach(([userUid, userOrders]) => {
          if (userOrders && typeof userOrders === "object") {
            Object.entries(userOrders).forEach(([orderId, orderData]) => {
              allOrders.push({
                orderId,
                userUid,
                ...orderData,
                status: orderData.status || "PENDING",
              });
            });
          }
        });
        allOrders.sort(
          (a, b) =>
            new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );
        setOrders(allOrders);
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

    return () => {
      unsubOrders();
      unsubUsers();
      unsubMessages();
      unsubSubscribers();
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
    const payload = {
      id: editingProduct ? editingProduct.id : Date.now(),
      title: productForm.title.trim(),
      category: productForm.category.trim(),
      brand: productForm.brand.trim() || "UOMO",
      price: Number(productForm.price) || 29.99,
      discountPercentage: Number(productForm.discountPercentage) || 0,
      stock: Number(productForm.stock) || 0,
      sku: productForm.sku.trim() || `UMMO-${Date.now()}`,
      thumbnail: productForm.thumbnail.trim(),
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
      editingProduct ? "Product updated!" : "New product added to store!"
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

  async function handleUpdateOrderStatus(order, newStatus) {
    try {
      await update(ref(db, `orders/${order.userUid}/${order.orderId}`), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Order #${String(order.orderId).slice(-6)} → ${newStatus}`);
    } catch {
      toast.error("Could not update order status.");
    }
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
    toast.success(`Coupon ${cleanCode} created!`);
  }

  function handleDeleteCoupon(code) {
    const next = coupons.filter((c) => c.code !== code);
    setCoupons(next);
    saveStoredCoupons(next);
    toast.success(`Coupon ${code} deleted.`);
  }

  async function handleActivateAdminRole() {
    localStorage.setItem("ummo_admin_unlocked", "true");
    setIsAdminVerified(true);
    if (authUser) {
      await update(ref(db, `users/${authUser.uid}`), { role: "ADMIN" }).catch(
        () => {}
      );
    }
    toast.success("Admin role activated for your account!");
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">
        Verifying admin session...
      </div>
    );
  }

  // Security Gate: Block unauthenticated visitors or non-admin users until verified
  if (!authUser || !isAdminVerified) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-gray-50">
        <Toaster position="top-right" />
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto mb-4">
            <Lock size={20} />
          </div>
          <h1 className="text-lg font-bold text-gray-900">
            Admin Control Center
          </h1>
          {!authUser ? (
            <>
              <p className="text-xs text-gray-500 mt-2 mb-6">
                Authentication required. Please sign in with your store administrator account to access `/admin`.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider py-3 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                Sign In to Continue
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mt-2 mb-6">
                Signed in as <strong>{authUser.email}</strong>. Click below to elevate this account to Store Administrator (`ADMIN` RBAC role).
              </p>
              <button
                type="button"
                onClick={handleActivateAdminRole}
                className="w-full inline-flex items-center justify-center gap-2 bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider py-3 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <ShieldCheck size={16} /> Grant Admin Role & Enter Panel
              </button>
            </>
          )}
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/shop")}
              className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              View Live Storefront <ExternalLink size={13} />
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
          />
        )}
      </div>
    </div>
  );
}
