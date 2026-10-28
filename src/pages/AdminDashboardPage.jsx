import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { onValue, ref, set, update } from "firebase/database";
import { db } from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tag,
  Users,
  Plus,
  Trash2,
  Edit3,
  Search,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Mail,
  ExternalLink,
} from "lucide-react";
import {
  fetchCatalogProducts,
  getCustomAdminProducts,
  saveCustomAdminProducts,
  getDeletedProductIds,
  saveDeletedProductIds,
  getStoredCoupons,
  saveStoredCoupons,
} from "../services/api";
import { Allitem } from "../slices/AllProductSlice";
import { addProduct } from "../slices/productSlice";

const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export default function AdminDashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const catalogProducts = useSelector((state) => state.AllProduct.Products);

  const [activeTab, setActiveTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customers, setCustomers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [coupons, setCoupons] = useState(() => getStoredCoupons());

  // Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    title: "",
    category: "womens-dresses",
    brand: "UOMO",
    price: "",
    stock: "25",
    sku: "",
    thumbnail:
      "https://cdn.dummyjson.com/products/images/womens-dresses/Black%20Women's%20Gown/thumbnail.png",
    description: "",
  });

  // Coupon Form State
  const [couponForm, setCouponForm] = useState({
    code: "",
    type: "percentage",
    value: "",
    minOrder: "50",
    description: "",
  });

  // Load Catalog Products
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

  // Listen to Firebase Realtime DB for Orders, Users, Messages & Subscribers
  useEffect(() => {
    const unsubOrders = onValue(ref(db, "orders"), (snapshot) => {
      if (!snapshot.exists()) {
        setOrders([]);
        return;
      }
      const rootVal = snapshot.val();
      const allOrders = [];
      Object.entries(rootVal).forEach(([userUid, userOrders]) => {
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
    });

    const unsubUsers = onValue(ref(db, "users"), (snapshot) => {
      if (!snapshot.exists()) {
        setCustomers([]);
        return;
      }
      const list = Object.entries(snapshot.val()).map(([uid, data]) => ({
        uid,
        ...data,
      }));
      setCustomers(list);
    });

    const unsubMessages = onValue(ref(db, "messages"), (snapshot) => {
      if (!snapshot.exists()) {
        setMessages([]);
        return;
      }
      const list = Object.entries(snapshot.val())
        .map(([id, data]) => ({ id, ...data }))
        .reverse();
      setMessages(list);
    });

    const unsubSubscribers = onValue(ref(db, "subscribers"), (snapshot) => {
      if (!snapshot.exists()) {
        setSubscribers([]);
        return;
      }
      const list = Object.entries(snapshot.val())
        .map(([id, data]) => ({ id, ...data }))
        .reverse();
      setSubscribers(list);
    });

    return () => {
      unsubOrders();
      unsubUsers();
      unsubMessages();
      unsubSubscribers();
    };
  }, []);

  // Analytics Calculations
  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELLED");
    const totalRevenue = validOrders.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );
    const pendingOrders = orders.filter(
      (o) => (o.status || "PENDING") === "PENDING"
    ).length;
    const lowStockProducts = products.filter(
      (p) => Number(p.stock ?? 0) < 10
    ).length;

    return {
      totalRevenue,
      totalOrders: orders.length,
      pendingOrders,
      totalProducts: products.length,
      lowStockProducts,
      totalCustomers: customers.length,
    };
  }, [orders, products, customers]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        String(p.sku || "").toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "ALL") return orders;
    return orders.filter((o) => (o.status || "PENDING") === statusFilter);
  }, [orders, statusFilter]);

  function openAddProductModal() {
    setEditingProduct(null);
    setProductForm({
      title: "",
      category: "womens-dresses",
      brand: "UOMO",
      price: "",
      stock: "30",
      sku: `UMMO-${Math.floor(1000 + Math.random() * 9000)}`,
      thumbnail:
        "https://cdn.dummyjson.com/products/images/womens-dresses/Black%20Women's%20Gown/thumbnail.png",
      description: "",
    });
    setShowProductModal(true);
  }

  function openEditProductModal(product) {
    setEditingProduct(product);
    setProductForm({
      title: product.title || "",
      category: product.category || "womens-dresses",
      brand: product.brand || "UOMO",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? 20),
      sku: product.sku || `UMMO-${product.id}`,
      thumbnail: product.thumbnail || "",
      description: product.description || "",
    });
    setShowProductModal(true);
  }

  function handleSaveProduct(e) {
    e.preventDefault();
    const customList = getCustomAdminProducts();

    const payload = {
      id: editingProduct ? editingProduct.id : Date.now(),
      title: productForm.title.trim(),
      category: productForm.category.trim(),
      brand: productForm.brand.trim() || "UOMO",
      price: Number(productForm.price) || 29.99,
      stock: Number(productForm.stock) || 0,
      sku: productForm.sku.trim() || `UMMO-${Date.now()}`,
      thumbnail: productForm.thumbnail.trim(),
      description:
        productForm.description.trim() ||
        "Premium UOMO collection item crafted with high quality materials.",
      reviews: editingProduct?.reviews || [],
      dimensions: editingProduct?.dimensions || {
        width: 12,
        height: 18,
        depth: 4,
      },
      weight: editingProduct?.weight || 1,
      warrantyInformation: "1 Year Official Brand Warranty",
      isCustomNew: editingProduct ? Boolean(editingProduct.isCustomNew) : true,
    };

    const existingIdx = customList.findIndex(
      (item) => String(item.id) === String(payload.id)
    );
    if (existingIdx >= 0) {
      customList[existingIdx] = payload;
    } else {
      customList.unshift(payload);
    }
    saveCustomAdminProducts(customList);

    const updatedCatalog = editingProduct
      ? products.map((p) =>
          String(p.id) === String(payload.id) ? { ...p, ...payload } : p
        )
      : [payload, ...products];

    setProducts(updatedCatalog);
    dispatch(Allitem(updatedCatalog));
    dispatch(addProduct(updatedCatalog));

    setShowProductModal(false);
    toast.success(
      editingProduct
        ? "Product updated successfully!"
        : "New product added to catalog!"
    );
  }

  function handleDeleteProduct(productId) {
    const deletedIds = getDeletedProductIds();
    if (!deletedIds.includes(productId)) {
      deletedIds.push(productId);
      saveDeletedProductIds(deletedIds);
    }

    const updated = products.filter((p) => String(p.id) !== String(productId));
    setProducts(updated);
    dispatch(Allitem(updated));
    dispatch(addProduct(updated));
    toast.success("Product removed from catalog.");
  }

  async function handleUpdateOrderStatus(order, newStatus) {
    try {
      await update(ref(db, `orders/${order.userUid}/${order.orderId}`), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Order #${order.orderId.slice(-6)} marked as ${newStatus}`);
    } catch (err) {
      toast.error("Failed to update order status: " + err.message);
    }
  }

  function handleCreateCoupon(e) {
    e.preventDefault();
    const code = couponForm.code.trim().toUpperCase();
    if (!code || !couponForm.value) return;

    if (coupons.some((c) => c.code === code)) {
      toast.error("Coupon code already exists!");
      return;
    }

    const newCoupon = {
      code,
      type: couponForm.type,
      value: Number(couponForm.value),
      minOrder: Number(couponForm.minOrder) || 0,
      description:
        couponForm.description.trim() ||
        `${
          couponForm.type === "percentage"
            ? `${couponForm.value}% OFF`
            : `$${couponForm.value} OFF`
        } on orders above $${couponForm.minOrder || 0}`,
      active: true,
    };

    const updated = [newCoupon, ...coupons];
    setCoupons(updated);
    saveStoredCoupons(updated);
    setCouponForm({
      code: "",
      type: "percentage",
      value: "",
      minOrder: "50",
      description: "",
    });
    toast.success(`Coupon ${code} created!`);
  }

  function handleToggleCoupon(code) {
    const updated = coupons.map((c) =>
      c.code === code ? { ...c, active: !c.active } : c
    );
    setCoupons(updated);
    saveStoredCoupons(updated);
  }

  function handleDeleteCoupon(code) {
    const updated = coupons.filter((c) => c.code !== code);
    setCoupons(updated);
    saveStoredCoupons(updated);
    toast.success(`Coupon ${code} deleted.`);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-jost text-primary">
      <Toaster position="top-center" />

      {/* Top Admin Header */}
      <div className="bg-primary text-white border-b border-gray-800">
        <div className="container px-4 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-widest text-[#B9A16B] font-semibold">
              Enterprise Control Center
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-wide mt-0.5">
              UMMO ADMIN PANEL
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openAddProductModal}
              className="flex items-center gap-2 bg-[#B9A16B] text-white text-xs uppercase font-medium px-4 py-2.5 rounded-md cursor-pointer hover:opacity-90"
            >
              <Plus size={15} /> Add Product
            </button>
            <button
              onClick={() => navigate("/shop")}
              className="flex items-center gap-1.5 border border-white/30 text-white text-xs uppercase px-4 py-2.5 rounded-md cursor-pointer hover:bg-white/10"
            >
              View Storefront <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="container px-4 flex overflow-x-auto gap-2 sm:gap-6">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            {
              id: "products",
              label: `Products (${products.length})`,
              icon: Package,
            },
            {
              id: "orders",
              label: `Orders (${orders.length})`,
              icon: ShoppingCart,
            },
            {
              id: "coupons",
              label: `Coupons (${coupons.length})`,
              icon: Tag,
            },
            {
              id: "customers",
              label: `Customers & Inbox (${customers.length + messages.length})`,
              icon: Users,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-gray hover:text-primary"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="container px-4 py-8">
        {/* ==================== 1. OVERVIEW TAB ==================== */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Total Revenue"
                value={`$${metrics.totalRevenue.toFixed(2)}`}
                subtitle="Excluding cancelled orders"
                icon={<TrendingUp className="text-emerald-600" size={22} />}
              />
              <StatCard
                title="Total Orders"
                value={metrics.totalOrders}
                subtitle={`${metrics.pendingOrders} pending fulfillment`}
                icon={<ShoppingCart className="text-indigo-600" size={22} />}
              />
              <StatCard
                title="Active Catalog"
                value={metrics.totalProducts}
                subtitle={`${metrics.lowStockProducts} items low on stock`}
                icon={<Package className="text-amber-600" size={22} />}
              />
              <StatCard
                title="Registered Users"
                value={metrics.totalCustomers}
                subtitle={`${subscribers.length} newsletter subscribers`}
                icon={<Users className="text-purple-600" size={22} />}
              />
            </div>

            {/* Order Status Pipeline & Recent Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-base font-semibold mb-4">
                  Order Fulfillment Pipeline
                </h3>
                <div className="space-y-4">
                  {ORDER_STATUSES.map((status) => {
                    const count = orders.filter(
                      (o) => (o.status || "PENDING") === status
                    ).length;
                    const pct = orders.length
                      ? Math.round((count / orders.length) * 100)
                      : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span>{status}</span>
                          <span>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold">Recent Orders</h3>
                  <button
                    onClick={() => setActiveTab("orders")}
                    className="text-xs font-medium underline cursor-pointer"
                  >
                    Manage All Orders
                  </button>
                </div>

                {orders.length === 0 ? (
                  <p className="text-sm text-gray py-8 text-center">
                    No customer orders placed yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray uppercase">
                          <th className="py-2.5">Order ID</th>
                          <th className="py-2.5">Customer</th>
                          <th className="py-2.5">Total</th>
                          <th className="py-2.5">Status</th>
                          <th className="py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {orders.slice(0, 6).map((o) => (
                          <tr key={o.orderId}>
                            <td className="py-3 font-medium">
                              #{o.orderId.slice(-6)}
                            </td>
                            <td className="py-3">
                              {o.username || o.email || "Customer"}
                            </td>
                            <td className="py-3 font-semibold">
                              ${Number(o.total || 0).toFixed(2)}
                            </td>
                            <td className="py-3">
                              <StatusBadge status={o.status || "PENDING"} />
                            </td>
                            <td className="py-3 text-right">
                              <select
                                value={o.status || "PENDING"}
                                onChange={(e) =>
                                  handleUpdateOrderStatus(o, e.target.value)
                                }
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                              >
                                {ORDER_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. PRODUCTS TAB ==================== */}
        {activeTab === "products" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="relative w-full sm:w-96">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, category, brand, or SKU..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={openAddProductModal}
                className="flex items-center justify-center gap-2 bg-primary text-white text-xs uppercase font-medium px-5 py-3 rounded-lg cursor-pointer hover:opacity-90"
              >
                <Plus size={16} /> Add New Product
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray uppercase">
                    <th className="py-3">Product</th>
                    <th className="py-3">Category</th>
                    <th className="py-3">Brand</th>
                    <th className="py-3">Price</th>
                    <th className="py-3">Stock</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.slice(0, 50).map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="py-3 flex items-center gap-3">
                        <img
                          src={product.thumbnail}
                          alt={product.title}
                          className="w-12 h-12 rounded object-contain bg-gray-100 shrink-0"
                        />
                        <div>
                          <p className="font-medium text-primary line-clamp-1">
                            {product.title}
                          </p>
                          <p className="text-xs text-gray">
                            SKU: {product.sku || `UMMO-${product.id}`}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 capitalize text-gray">
                        {product.category}
                      </td>
                      <td className="py-3 text-gray">
                        {product.brand || "UOMO"}
                      </td>
                      <td className="py-3 font-semibold">
                        ${Number(product.price || 0).toFixed(2)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                            Number(product.stock ?? 0) > 10
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {Number(product.stock ?? 0) <= 10 && (
                            <AlertTriangle size={12} />
                          )}
                          {product.stock ?? 20} in stock
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => openEditProductModal(product)}
                          className="p-1.5 text-gray hover:text-primary cursor-pointer"
                          title="Edit Product"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-1.5 text-gray hover:text-red-600 cursor-pointer"
                          title="Delete Product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== 3. ORDERS TAB ==================== */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">
                Customer Order Fulfillment ({filteredOrders.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {["ALL", ...ORDER_STATUSES].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium cursor-pointer transition-colors ${
                      statusFilter === st
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray hover:text-primary"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <p className="text-sm text-gray py-12 text-center">
                No orders matching "{statusFilter}".
              </p>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className="border border-gray-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-base">
                          Order #{order.orderId}
                        </span>
                        <StatusBadge status={order.status || "PENDING"} />
                      </div>
                      <p className="text-xs text-gray">
                        Customer:{" "}
                        <strong className="text-primary">
                          {order.username || "Guest"}
                        </strong>{" "}
                        ({order.email}) • Phone: {order.billing?.phone || "N/A"}
                      </p>
                      <p className="text-xs text-gray">
                        Shipping Address:{" "}
                        {[
                          order.billing?.streetAddress,
                          order.billing?.city,
                          order.billing?.province,
                          order.billing?.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <div className="pt-2 flex flex-wrap gap-2">
                        {(order.OrderItems || []).map((item, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-gray-100 px-2.5 py-1 rounded text-primary"
                          >
                            {item.title} × {item.quantity} ($
                            {Number(item.price).toFixed(2)})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex sm:items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-3 lg:pt-0">
                      <div className="text-left lg:text-right">
                        <p className="text-xs text-gray uppercase">
                          Grand Total ({order.paymentMethod})
                        </p>
                        <p className="text-lg font-bold text-primary">
                          ${Number(order.total || 0).toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={order.status || "PENDING"}
                          onChange={(e) =>
                            handleUpdateOrderStatus(order, e.target.value)
                          }
                          className="text-xs border border-gray-300 rounded-md px-3 py-2 bg-white font-medium"
                        >
                          {ORDER_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== 4. COUPONS TAB ==================== */}
        {activeTab === "coupons" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs h-fit">
              <h3 className="text-base font-semibold mb-4">
                Create Promo Coupon
              </h3>
              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SUMMER30"
                    value={couponForm.code}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, code: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray mb-1">
                      Discount Type
                    </label>
                    <select
                      value={couponForm.type}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, type: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray mb-1">
                      Discount Value *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="15"
                      value={couponForm.value}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, value: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray mb-1">
                    Minimum Order Subtotal ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={couponForm.minOrder}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        minOrder: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Optional promo description"
                    value={couponForm.description}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary text-white text-xs uppercase font-medium py-3 rounded-md cursor-pointer hover:opacity-90"
                >
                  Save Coupon
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
              <h3 className="text-base font-semibold mb-4">
                Active Store Coupons
              </h3>
              <div className="space-y-3">
                {coupons.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between border border-gray-200 rounded-lg p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm bg-gray-100 px-3 py-1 rounded tracking-wider">
                          {c.code}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            c.active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {c.active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-xs text-gray mt-1.5">
                        {c.description} • Min Order: ${c.minOrder}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleCoupon(c.code)}
                        className="text-xs underline cursor-pointer text-primary"
                      >
                        {c.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(c.code)}
                        className="text-gray hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. CUSTOMERS & INBOX TAB ==================== */}
        {activeTab === "customers" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
              <h3 className="text-base font-semibold mb-4">
                Registered Customers ({customers.length})
              </h3>
              {customers.length === 0 ? (
                <p className="text-sm text-gray py-6 text-center">
                  No registered users found in database.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {customers.map((c) => (
                    <div
                      key={c.uid}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            c.profile_picture ||
                            "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg"
                          }
                          alt={c.username}
                          className="w-10 h-10 rounded-full object-cover bg-gray-100"
                        />
                        <div>
                          <p className="text-sm font-medium">
                            {c.username || c.name || "Customer"}
                          </p>
                          <p className="text-xs text-gray">{c.email}</p>
                        </div>
                      </div>
                      <span className="text-[11px] uppercase bg-gray-100 px-2.5 py-1 rounded font-medium">
                        {c.role || "CUSTOMER"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <Mail size={18} /> Contact Form Inquiries ({messages.length})
                </h3>
                {messages.length === 0 ? (
                  <p className="text-sm text-gray py-4">
                    No customer messages received yet.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className="border border-gray-200 rounded-lg p-3.5 text-sm"
                      >
                        <div className="flex justify-between">
                          <span className="font-semibold">{m.name}</span>
                          <span className="text-xs text-gray">
                            {m.date
                              ? new Date(m.date).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                        <p className="text-xs text-gray mb-1.5">{m.email}</p>
                        <p className="text-gray-700 text-xs leading-relaxed">
                          {m.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-5">
                <h3 className="text-sm font-semibold mb-3">
                  Newsletter Subscribers ({subscribers.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {subscribers.map((s) => (
                    <span
                      key={s.id}
                      className="text-xs bg-gray-100 px-3 py-1 rounded-full text-primary"
                    >
                      {s.email}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== ADD / EDIT PRODUCT MODAL ==================== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">
              {editingProduct ? "Edit Product" : "Add New Catalog Product"}
            </h2>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={(e) =>
                    setProductForm({ ...productForm, title: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray mb-1">
                    Category *
                  </label>
                  <select
                    value={productForm.category}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        category: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="womens-dresses">womens-dresses</option>
                    <option value="womens-bags">womens-bags</option>
                    <option value="womens-shoes">womens-shoes</option>
                    <option value="womens-watches">womens-watches</option>
                    <option value="mens-shirts">mens-shirts</option>
                    <option value="mens-shoes">mens-shoes</option>
                    <option value="mens-watches">mens-watches</option>
                    <option value="beauty">beauty</option>
                    <option value="fragrances">fragrances</option>
                    <option value="furniture">furniture</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={productForm.brand}
                    onChange={(e) =>
                      setProductForm({ ...productForm, brand: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray mb-1">
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm({ ...productForm, price: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray mb-1">
                    Stock Qty *
                  </label>
                  <input
                    type="number"
                    required
                    value={productForm.stock}
                    onChange={(e) =>
                      setProductForm({ ...productForm, stock: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm({ ...productForm, sku: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray mb-1">
                  Image URL *
                </label>
                <input
                  type="url"
                  required
                  value={productForm.thumbnail}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      thumbnail: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-xs uppercase border border-gray-300 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs uppercase bg-primary text-white rounded-md cursor-pointer"
                >
                  {editingProduct ? "Update Product" : "Publish Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-gray font-medium">
          {title}
        </p>
        <p className="text-2xl font-bold text-primary mt-1">{value}</p>
        <p className="text-xs text-gray mt-1">{subtitle}</p>
      </div>
      <div className="p-3 bg-gray-50 rounded-lg">{icon}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
    SHIPPED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
        styles[status] || styles.PENDING
      }`}
    >
      {status}
    </span>
  );
}
