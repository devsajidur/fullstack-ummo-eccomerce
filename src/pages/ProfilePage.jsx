import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { auth, db } from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import {
  Copy,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { getStoredCoupons } from "../services/api";
import ProfileOrdersTab from "../components/profile/ProfileOrdersTab";
import ProfileAddressesTab from "../components/profile/ProfileAddressesTab";
import ProfileSettingsTab from "../components/profile/ProfileSettingsTab";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function ProfilePage() {
  const navigate = useNavigate();
  const wishCount = useSelector(
    (state) => (state.wishList.wishProduct || []).length
  );

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [coupons] = useState(() => getStoredCoupons());
  const [profileForm, setProfileForm] = useState({
    username: "",
    phone: "",
    bio: "",
  });

  useEffect(() => {
    let unsubOrders;
    let unsubAddresses;
    let unsubUserProfile;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(currentUser);

      unsubUserProfile = onValue(
        ref(db, `users/${currentUser.uid}`),
        (snap) => {
          const val = snap.val() || {};
          setProfileForm({
            username: val.username || currentUser.displayName || "",
            phone: val.phone || "",
            bio: val.bio || "",
          });
        }
      );

      unsubOrders = onValue(ref(db, `orders/${currentUser.uid}`), (snap) => {
        if (!snap.exists()) {
          setOrders([]);
        } else {
          const list = Object.entries(snap.val())
            .map(([id, data]) => ({ id, ...data }))
            .sort(
              (a, b) =>
                new Date(b.date || 0).getTime() -
                new Date(a.date || 0).getTime()
            );
          setOrders(list);
        }
        setLoading(false);
      });

      unsubAddresses = onValue(
        ref(db, `addresses/${currentUser.uid}`),
        (snap) => {
          if (!snap.exists()) {
            setAddresses([]);
          } else {
            setAddresses(
              Object.entries(snap.val()).map(([id, data]) => ({
                id,
                ...data,
              }))
            );
          }
        }
      );
    });

    return () => {
      unsubAuth();
      unsubOrders?.();
      unsubAddresses?.();
      unsubUserProfile?.();
    };
  }, []);

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "CANCELLED");
    const totalSpent = valid.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const activeOrders = orders.filter(
      (o) => !["DELIVERED", "CANCELLED"].includes(o.status || "PENDING")
    ).length;
    return { totalOrders: orders.length, totalSpent, activeOrders };
  }, [orders]);

  async function handleCancelOrder(orderId) {
    if (!user) return;
    await update(ref(db, `orders/${user.uid}/${orderId}`), {
      status: "CANCELLED",
      updatedAt: new Date().toISOString(),
    });
    toast.success("Order cancelled.");
  }

  async function handleAddAddress(addrForm) {
    if (!user) return;
    const newRef = push(ref(db, `addresses/${user.uid}`));
    await set(newRef, {
      ...addrForm,
      isDefault: addresses.length === 0,
      createdAt: new Date().toISOString(),
    });
    toast.success("Shipping address saved!");
  }

  async function handleSetDefaultAddress(addrId) {
    if (!user) return;
    const updates = {};
    addresses.forEach((a) => {
      updates[`${a.id}/isDefault`] = a.id === addrId;
    });
    await update(ref(db, `addresses/${user.uid}`), updates);
    toast.success("Default checkout address updated!");
  }

  async function handleDeleteAddress(addrId) {
    if (!user) return;
    await remove(ref(db, `addresses/${user.uid}/${addrId}`));
    toast.success("Address deleted.");
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!user) return;
    await updateProfile(user, { displayName: profileForm.username });
    await update(ref(db, `users/${user.uid}`), {
      username: profileForm.username,
      phone: profileForm.phone,
      bio: profileForm.bio,
    });
    toast.success("Profile updated!");
  }

  async function handleSendPasswordReset() {
    if (!user?.email) return;
    await sendPasswordResetEmail(auth, user.email);
    toast.success(`Password reset link sent to ${user.email}`);
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">
        Loading your dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-gray-600">
          Please sign in to access your Customer Dashboard.
        </p>
        <Link
          to="/login"
          className="bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-lg"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6">
      <Toaster position="top-right" />
      <div className="container mx-auto max-w-6xl">
        {/* Header Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Welcome back, {profileForm.username || user.displayName || "Customer"}
            </h1>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-gray-50"
            >
              <ShieldCheck size={14} /> Admin Panel
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut(auth);
                navigate("/login");
              }}
              className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "overview", label: "Overview & Coupons", icon: LayoutDashboard },
            { id: "orders", label: `My Orders (${orders.length})`, icon: Package },
            { id: "addresses", label: `Address Book (${addresses.length})`, icon: MapPin },
            { id: "settings", label: "Account & Security", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
                }`}
              >
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatBox label="Total Orders" value={stats.totalOrders} />
              <StatBox label="Active Shipments" value={stats.activeOrders} />
              <StatBox
                label="Lifetime Spend"
                value={currency.format(stats.totalSpent)}
              />
              <StatBox label="Saved Wishlist" value={wishCount} />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                <Tag size={15} /> Exclusive Store Promo Coupons
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {coupons.map((cp) => (
                  <div
                    key={cp.code}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold bg-gray-900 text-white px-2 py-0.5 rounded">
                        {cp.code}
                      </span>
                      <p className="text-xs text-gray-600 mt-1.5">
                        {cp.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(cp.code);
                        toast.success(`Copied ${cp.code}!`);
                      }}
                      className="text-xs font-semibold text-gray-700 hover:text-black inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <ProfileOrdersTab
              orders={orders.slice(0, 3)}
              onCancelOrder={handleCancelOrder}
            />
          </div>
        )}

        {activeTab === "orders" && (
          <ProfileOrdersTab orders={orders} onCancelOrder={handleCancelOrder} />
        )}

        {activeTab === "addresses" && (
          <ProfileAddressesTab
            addresses={addresses}
            onAddAddress={handleAddAddress}
            onSetDefaultAddress={handleSetDefaultAddress}
            onDeleteAddress={handleDeleteAddress}
          />
        )}

        {activeTab === "settings" && (
          <ProfileSettingsTab
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            onSaveProfile={handleSaveProfile}
            onSendPasswordReset={handleSendPasswordReset}
            userEmail={user.email}
          />
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
