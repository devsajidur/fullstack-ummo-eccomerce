import { useEffect, useState } from "react";
import { CiMail, CiPhone, CiLocationOn } from "react-icons/ci";
import { FaRegCheckCircle } from "react-icons/fa";
import { GoXCircle } from "react-icons/go";
import {
  LogOut,
  Package,
  MapPin,
  Settings,
  User as UserIcon,
  ShieldCheck,
  Heart,
  Tag,
  Plus,
  Trash2,
} from "lucide-react";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { onValue, push, ref, remove, update } from "firebase/database";
import { auth, db } from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { getStoredCoupons } from "../services/api";

const TRACKING_STEPS = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const WishData = useSelector((state) => state.wishList.wishProduct);
  const navigate = useNavigate();
  const activeCoupons = getStoredCoupons().filter((c) => c.active);

  // Profile Settings State
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // New Address State
  const [addressForm, setAddressForm] = useState({
    label: "Home",
    firstName: "",
    lastName: "",
    country: "Bangladesh",
    streetAddress: "",
    city: "",
    province: "",
    postcode: "",
    phone: "",
  });

  useEffect(() => {
    let unsubscribeOrders = null;
    let unsubscribeAddresses = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || "");
        setPhotoURL(currentUser.photoURL || "");

        const ordersRef = ref(db, `orders/${currentUser.uid}`);
        unsubscribeOrders = onValue(ordersRef, (snapshot) => {
          if (snapshot.exists()) {
            const raw = snapshot.val();
            const list = Object.entries(raw)
              .map(([orderId, data]) => ({
                orderId,
                ...data,
                status: data.status || "PENDING",
              }))
              .sort(
                (a, b) =>
                  new Date(b.date || 0).getTime() -
                  new Date(a.date || 0).getTime()
              );
            setOrders(list);
          } else {
            setOrders([]);
          }
        });

        const addrRef = ref(db, `addresses/${currentUser.uid}`);
        unsubscribeAddresses = onValue(addrRef, (snapshot) => {
          if (snapshot.exists()) {
            const list = Object.entries(snapshot.val()).map(([id, data]) => ({
              id,
              ...data,
            }));
            setAddresses(list);
            if (list[0]) {
              localStorage.setItem(
                "ummo_default_address",
                JSON.stringify(list[0])
              );
            }
          } else {
            setAddresses([]);
          }
        });
      } else {
        setUser(null);
        setOrders([]);
        setAddresses([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeOrders?.();
      unsubscribeAddresses?.();
    };
  }, []);

  function handleLogOut() {
    signOut(auth)
      .then(() => {
        toast.success("Logged out successfully");
      })
      .catch((error) => {
        toast.error(error?.message || "Logout failed");
      });
  }

  async function handleCancelOrder(orderId) {
    if (!user) return;
    try {
      await update(ref(db, `orders/${user.uid}/${orderId}`), {
        status: "CANCELLED",
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Order #${orderId.slice(-6)} has been cancelled.`);
    } catch (err) {
      toast.error("Could not cancel order: " + err.message);
    }
  }

  async function handleSaveAddress(e) {
    e.preventDefault();
    if (!user) return;
    try {
      await push(ref(db, `addresses/${user.uid}`), {
        ...addressForm,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("ummo_default_address", JSON.stringify(addressForm));
      setAddressForm({
        label: "Home",
        firstName: "",
        lastName: "",
        country: "Bangladesh",
        streetAddress: "",
        city: "",
        province: "",
        postcode: "",
        phone: "",
      });
      toast.success("Shipping address saved to your address book!");
    } catch (err) {
      toast.error("Could not save address: " + err.message);
    }
  }

  async function handleDeleteAddress(addressId) {
    if (!user) return;
    try {
      await remove(ref(db, `addresses/${user.uid}/${addressId}`));
      toast.success("Address removed.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSavingProfile(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
      });
      await update(ref(db, `users/${auth.currentUser.uid}`), {
        username: displayName.trim(),
        name: displayName.trim(),
        profile_picture: photoURL.trim(),
        phone: phone.trim(),
      });
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err.message || "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-jost">
        <div className="text-gray-500">Loading customer dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] bg-gray-50 flex flex-col items-center justify-center px-4 text-center font-jost">
        <UserIcon size={48} className="text-gray mb-4" />
        <h1 className="text-2xl font-bold text-primary mb-2">
          Customer Account Portal
        </h1>
        <p className="text-sm text-gray max-w-md mb-6">
          Sign in to track your live orders, manage saved shipping addresses,
          view exclusive discount coupons, and download order invoices.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/login")}
            className="bg-primary text-white text-xs uppercase font-medium px-8 py-3.5 rounded-md cursor-pointer hover:opacity-90"
          >
            Log In
          </button>
          <button
            onClick={() => navigate("/register")}
            className="border border-primary text-primary text-xs uppercase font-medium px-8 py-3.5 rounded-md cursor-pointer hover:bg-gray-100"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  const joinedDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  const totalSpent = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 font-jost text-primary">
      <Toaster position="top-center" reverseOrder={false} />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Profile Header Card */}
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="h-28 bg-linear-to-r from-[#222222] via-[#3a3a3a] to-[#B9A16B]" />

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 mb-4 gap-4">
              <div className="flex items-end gap-4">
                <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-200 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon size={36} className="text-gray" />
                  )}
                </div>
                <div className="pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-gray-900">
                      {user?.displayName || "Valued Customer"}
                    </h1>
                    {user?.emailVerified ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        <FaRegCheckCircle size={12} /> Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        <GoXCircle size={12} /> Unverified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {user?.email} • Member since {joinedDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 bg-[#B9A16B] text-white text-xs font-medium rounded-lg px-3.5 py-2 hover:opacity-90"
                >
                  <ShieldCheck size={15} /> Admin Panel
                </Link>
                <button
                  onClick={handleLogOut}
                  className="flex cursor-pointer hover:bg-gray-100 items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg px-3.5 py-2 transition-colors"
                >
                  Log Out <LogOut size={14} />
                </button>
              </div>
            </div>

            {/* Dashboard Navigation Tabs */}
            <div className="flex overflow-x-auto gap-2 sm:gap-6 border-t border-gray-100 pt-4 mt-4">
              {[
                { id: "overview", label: "Dashboard Overview", icon: UserIcon },
                {
                  id: "orders",
                  label: `My Orders (${orders.length})`,
                  icon: Package,
                },
                {
                  id: "addresses",
                  label: `Addresses (${addresses.length})`,
                  icon: MapPin,
                },
                {
                  id: "settings",
                  label: "Account Settings",
                  icon: Settings,
                },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "text-gray hover:bg-gray-100 hover:text-primary"
                    }`}
                  >
                    <Icon size={15} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==================== TAB 1: OVERVIEW ==================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <p className="text-xs text-gray uppercase">Total Orders</p>
                <p className="text-2xl font-bold mt-1">{orders.length}</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <p className="text-xs text-gray uppercase">Total Spent</p>
                <p className="text-2xl font-bold mt-1">
                  ${totalSpent.toFixed(2)}
                </p>
              </div>
              <div
                onClick={() => navigate("/wishlist")}
                className="bg-white p-5 rounded-xl border border-gray-200 cursor-pointer hover:border-primary"
              >
                <p className="text-xs text-gray uppercase flex items-center gap-1">
                  Wishlist Items <Heart size={12} />
                </p>
                <p className="text-2xl font-bold mt-1">{WishData.length}</p>
              </div>
              <div
                onClick={() => setActiveTab("addresses")}
                className="bg-white p-5 rounded-xl border border-gray-200 cursor-pointer hover:border-primary"
              >
                <p className="text-xs text-gray uppercase">Saved Addresses</p>
                <p className="text-2xl font-bold mt-1">{addresses.length}</p>
              </div>
            </div>

            {/* Available Promo Coupons */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Tag size={18} className="text-[#B9A16B]" /> Exclusive Promo
                Codes for You
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {activeCoupons.map((c) => (
                  <div
                    key={c.code}
                    className="border border-dashed border-[#B9A16B] bg-[#B9A16B]/5 rounded-lg p-4 flex flex-col justify-between"
                  >
                    <div>
                      <span className="font-bold text-sm bg-primary text-white px-2.5 py-1 rounded tracking-wider">
                        {c.code}
                      </span>
                      <p className="text-xs text-gray mt-2">{c.description}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(c.code);
                        toast.success(`Copied code: ${c.code}`);
                      }}
                      className="mt-3 text-xs font-semibold underline text-left cursor-pointer text-primary"
                    >
                      Copy Code
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: MY ORDERS & LIVE TRACKING ==================== */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                My Orders & Live Tracking ({orders.length})
              </h2>
              <Link
                to="/shop"
                className="text-xs font-medium uppercase bg-primary text-white px-4 py-2 rounded-md"
              >
                Continue Shopping
              </Link>
            </div>

            {orders.length === 0 ? (
              <p className="text-sm text-gray-500 py-10 text-center">
                You haven't placed any orders yet.
              </p>
            ) : (
              <div className="space-y-6">
                {orders.map((order) => {
                  const status = order.status || "PENDING";
                  const stepIdx = TRACKING_STEPS.indexOf(status);

                  return (
                    <div
                      key={order.orderId}
                      className="border border-gray-200 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                        <div>
                          <p className="text-sm font-bold">
                            Order #{order.orderId}
                          </p>
                          <p className="text-xs text-gray">
                            Placed on{" "}
                            {order.date
                              ? new Date(order.date).toLocaleString()
                              : "Recent"}{" "}
                            • Payment: {order.paymentMethod}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold">
                            ${Number(order.total || 0).toFixed(2)}
                          </span>
                          <Link
                            to={`/ordercomplete?orderId=${order.orderId}`}
                            className="text-xs bg-primary text-white px-3.5 py-2 rounded-md hover:opacity-90"
                          >
                            View Invoice
                          </Link>
                          {status === "PENDING" && (
                            <button
                              onClick={() => handleCancelOrder(order.orderId)}
                              className="text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-md cursor-pointer hover:bg-red-50"
                            >
                              Cancel Order
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Visual 4-Step Order Progress Tracker */}
                      {status === "CANCELLED" ? (
                        <div className="bg-red-50 text-red-700 text-xs font-medium px-4 py-2.5 rounded-lg">
                          This order was cancelled.
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          {TRACKING_STEPS.map((step, idx) => {
                            const completed = idx <= stepIdx;
                            return (
                              <div key={step} className="text-center">
                                <div
                                  className={`h-1.5 w-full rounded-full mb-1.5 ${
                                    completed ? "bg-emerald-600" : "bg-gray-200"
                                  }`}
                                />
                                <span
                                  className={`text-[10px] sm:text-xs font-medium ${
                                    completed ? "text-primary" : "text-gray-400"
                                  }`}
                                >
                                  {step}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: ADDRESS BOOK ==================== */}
        {activeTab === "addresses" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit">
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Plus size={16} /> Add Shipping Address
              </h3>
              <form onSubmit={handleSaveAddress} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="First Name *"
                    value={addressForm.firstName}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        firstName: e.target.value,
                      })
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Last Name *"
                    value={addressForm.lastName}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        lastName: e.target.value,
                      })
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-xs"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Street Address *"
                  value={addressForm.streetAddress}
                  onChange={(e) =>
                    setAddressForm({
                      ...addressForm,
                      streetAddress: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="City *"
                    value={addressForm.city}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, city: e.target.value })
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Province *"
                    value={addressForm.province}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        province: e.target.value,
                      })
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Postcode *"
                    value={addressForm.postcode}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        postcode: e.target.value,
                      })
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-xs"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone *"
                    value={addressForm.phone}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, phone: e.target.value })
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary text-white text-xs uppercase font-medium py-3 rounded cursor-pointer hover:opacity-90"
                >
                  Save Address
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold mb-4">
                Saved Shipping Addresses
              </h3>
              {addresses.length === 0 ? (
                <p className="text-sm text-gray py-8 text-center">
                  No saved addresses yet. Add one on the left to auto-fill at
                  checkout!
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="border border-gray-200 rounded-lg p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">
                            {addr.firstName} {addr.lastName}
                          </span>
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="text-gray hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-gray">
                          {addr.streetAddress}, {addr.city}, {addr.province}{" "}
                          {addr.postcode}
                        </p>
                        <p className="text-xs text-gray mt-1">
                          Phone: {addr.phone}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          localStorage.setItem(
                            "ummo_default_address",
                            JSON.stringify(addr)
                          );
                          toast.success("Set as default checkout address!");
                        }}
                        className="mt-3 text-xs underline text-left text-primary cursor-pointer"
                      >
                        Use as Default Checkout Address
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: ACCOUNT SETTINGS ==================== */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
            <h3 className="text-base font-semibold mb-4">
              Update Profile & Security Settings
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs text-gray mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray mb-1">
                  Profile Photo URL
                </label>
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+880 1..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-primary text-white text-xs uppercase font-medium px-6 py-3 rounded-md cursor-pointer hover:opacity-90"
                >
                  {savingProfile ? "Saving..." : "Save Profile Changes"}
                </button>
                {!user.emailVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      sendEmailVerification(auth.currentUser)
                        .then(() =>
                          toast.success("Verification email sent! Check inbox.")
                        )
                        .catch((e) => toast.error(e.message));
                    }}
                    className="border border-gray-300 text-xs uppercase font-medium px-4 py-3 rounded-md cursor-pointer"
                  >
                    Resend Verification Email
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (user.email) {
                      sendPasswordResetEmail(auth, user.email)
                        .then(() =>
                          toast.success("Password reset link sent to email!")
                        )
                        .catch((e) => toast.error(e.message));
                    }
                  }}
                  className="border border-gray-300 text-xs uppercase font-medium px-4 py-3 rounded-md cursor-pointer"
                >
                  Send Password Reset Link
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
