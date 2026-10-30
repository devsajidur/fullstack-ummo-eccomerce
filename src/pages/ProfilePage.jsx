import React, { useEffect, useState } from "react";
import Container from "../components/layout/common/Container";
import Image from "../components/layout/common/Image";
import { Link, useNavigate, useSearchParams } from "react-router";
import { getAuth, updateProfile } from "firebase/auth";
import { useSelector } from "react-redux";
import {
  clearSessionUser,
  getLocalOrders,
  onUserChanged,
  setSessionUser,
  updateLocalOrderStatus,
} from "../services/authSession";
import {
  fetchStoreDataFromMongo,
  fetchUserAddressesFromMongo,
  saveUserAddressesToMongo,
  syncUserToMongo,
  updateOrderStatusInMongo,
} from "../services/api";
import toast, { Toaster } from "react-hot-toast";
import {
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  Truck,
} from "lucide-react";
import ProfileOrdersTab from "../components/profile/ProfileOrdersTab";
import ProfileAddressesTab from "../components/profile/ProfileAddressesTab";
import ProfileSettingsTab from "../components/profile/ProfileSettingsTab";
import { useLocalization } from "../i18n/LocalizationContext";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const ProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLocalization();

  const wishProduct = useSelector((state) => state.wishList.wishProduct || []);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get("tab") || "overview"
  );
  const [orders, setOrders] = useState([]);
  const [syncing, setSyncing] = useState(false);

  // Account Settings State
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Address Book State
  const [addresses, setAddresses] = useState([]);
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    street: "",
    city: "",
    country: "Bangladesh",
    postcode: "",
  });

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      ["overview", "orders", "addresses", "settings"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setSearchParams({ tab: nextTab });
  };

  useEffect(() => {
    const unsubscribe = onUserChanged((u) => {
      setUser(u || null);
      if (u) {
        setDisplayName(u.displayName || u.username || "");
        setPhotoURL(u.photoURL || "");
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const loadCustomerOrdersAndProfile = async (currentUser) => {
    if (!currentUser) return;
    setSyncing(true);
    const uid = currentUser.uid;
    const emailLower = (currentUser.email || "").toLowerCase();

    const localList = getLocalOrders().filter(
      (o) =>
        o.userUid === uid ||
        o.id === uid ||
        (emailLower && (o.email || "").toLowerCase() === emailLower)
    );

    try {
      const [cloudData, cloudAddr] = await Promise.all([
        fetchStoreDataFromMongo({ userUid: uid }),
        fetchUserAddressesFromMongo(uid),
      ]);

      const remoteOrders = (cloudData?.orders || []).filter(
        (o) =>
          o.userUid === uid ||
          o.id === uid ||
          (emailLower && (o.email || "").toLowerCase() === emailLower)
      );

      const orderMap = new Map();
      [...remoteOrders, ...localList].forEach((ord) => {
        const key = ord.orderId || `${ord.email}-${ord.total}-${ord.date}`;
        if (!orderMap.has(key)) {
          orderMap.set(key, ord);
        }
      });

      const mergedOrders = Array.from(orderMap.values()).sort(
        (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
      );
      setOrders(mergedOrders);

      const savedLocalAddr = JSON.parse(
        localStorage.getItem(`ummo_addresses_${uid}`) || "[]"
      );
      setAddresses(cloudAddr.length > 0 ? cloudAddr : savedLocalAddr);

      const dbProfile = (cloudData?.users || []).find((u) => u.uid === uid);
      if (dbProfile) {
        if (dbProfile.phone) setPhone(dbProfile.phone);
        if (dbProfile.bio) setBio(dbProfile.bio);
        if (dbProfile.username) setDisplayName(dbProfile.username);
        if (dbProfile.profile_picture) setPhotoURL(dbProfile.profile_picture);
      }
    } catch {
      setOrders(localList);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadCustomerOrdersAndProfile(user);
    }
  }, [user]);

  const handleLogout = async () => {
    await clearSessionUser();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName.trim() || "Uomo Customer",
          photoURL: photoURL.trim() || user.photoURL,
        });
      }

      const updatedUser = setSessionUser({
        ...user,
        displayName: displayName.trim() || "Uomo Customer",
        username: displayName.trim() || "Uomo Customer",
        photoURL: photoURL.trim() || user.photoURL,
      });
      setUser(updatedUser);

      await syncUserToMongo({
        uid: user.uid,
        username: displayName.trim() || "Uomo Customer",
        email: user.email,
        phone: phone.trim(),
        bio: bio.trim(),
        profile_picture: photoURL.trim() || user.photoURL,
      });

      toast.success("Account settings saved!");
    } catch {
      toast.error("Could not update profile settings.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!newAddress.street.trim() || !newAddress.city.trim()) {
      toast.error("Please enter street and city");
      return;
    }
    const updated = [
      ...addresses,
      {
        id: `ADDR-${Date.now()}`,
        ...newAddress,
      },
    ];
    setAddresses(updated);
    localStorage.setItem(
      `ummo_addresses_${user.uid}`,
      JSON.stringify(updated)
    );
    await saveUserAddressesToMongo(user.uid, updated);
    setNewAddress({
      label: "Home",
      street: "",
      city: "",
      country: "Bangladesh",
      postcode: "",
    });
    toast.success("Shipping address saved!");
  };

  const handleRemoveAddress = async (id) => {
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    localStorage.setItem(
      `ummo_addresses_${user.uid}`,
      JSON.stringify(updated)
    );
    await saveUserAddressesToMongo(user.uid, updated);
    toast.success("Address removed");
  };

  const handleCancelCustomerOrder = async (orderId) => {
    updateLocalOrderStatus(orderId, "CANCELLED");
    setOrders((prev) =>
      prev.map((o) =>
        (o.orderId || o.id) === orderId ? { ...o, status: "CANCELLED" } : o
      )
    );
    try {
      await updateOrderStatusInMongo(orderId, "CANCELLED");
    } catch {
      // local state already updated
    }
    toast.success(`Order ${orderId} has been cancelled.`);
  };

  if (!authReady) {
    return (
      <Container>
        <div className="py-24 text-center text-gray-500 text-sm">
          Loading your customer profile...
        </div>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container>
        <div className="py-16 px-4 text-center max-w-md mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2 uppercase">
            Sign In Required
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-6">
            Please sign in to view your orders, track deliveries, and manage
            your account settings.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/login"
              className="bg-primary text-white px-6 min-h-[44px] flex items-center text-xs font-bold uppercase tracking-wider rounded-lg"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="border border-primary text-primary px-6 min-h-[44px] flex items-center text-xs font-bold uppercase tracking-wider rounded-lg"
            >
              Register
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  const totalSpent = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.total ?? o.totalAmount ?? 0), 0);

  const activeDeliveries = orders.filter(
    (o) =>
      o.status !== "CANCELLED" &&
      o.status !== "DELIVERED"
  );

  const navTabs = [
    {
      id: "overview",
      label: t("profile.overview", "Overview"),
      icon: LayoutDashboard,
    },
    {
      id: "orders",
      label: `${t("profile.orders", "My Orders")} (${orders.length})`,
      icon: Package,
    },
    {
      id: "addresses",
      label: `${t("profile.addresses", "Addresses")} (${addresses.length})`,
      icon: MapPin,
    },
    {
      id: "settings",
      label: t("profile.settings", "Account Settings"),
      icon: Settings,
    },
  ];

  return (
    <section className="py-6 sm:py-10 px-3 sm:px-4 bg-gray-50/60 min-h-[80vh]">
      <Toaster />
      <Container>
        <div className="max-w-5xl mx-auto">
          {/* Customer Profile Header Card (No Public Admin Panel Link per Gate 1 & Gate 9) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-gray-900 bg-gray-100 shrink-0">
                <Image
                  className="w-full h-full object-cover"
                  src={
                    photoURL ||
                    user.photoURL ||
                    "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg"
                  }
                  alt={displayName || "Profile"}
                />
              </div>
              <div className="min-w-0">
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest bg-gray-900 text-white px-2.5 py-0.5 rounded-full">
                  Verified Customer
                </span>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 truncate">
                  {displayName || user.displayName || "Uomo Customer"}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => loadCustomerOrdersAndProfile(user)}
                className="inline-flex items-center gap-1.5 text-xs font-bold border border-gray-200 bg-white px-3.5 min-h-[40px] rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <RefreshCw
                  size={14}
                  className={syncing ? "animate-spin" : ""}
                />
                Sync
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 text-white px-4 min-h-[40px] rounded-lg hover:bg-red-700 cursor-pointer"
              >
                <LogOut size={14} />
                {t("profile.logout", "Sign Out")}
              </button>
            </div>
          </div>

          {/* 4-Card Responsive Customer KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {t("profile.totalOrders", "Total Orders")}
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-1">
                {orders.length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {t("profile.activeOrdersCount", "Active Deliveries")}
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">
                {activeDeliveries.length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {t("profile.savedWishlist", "Saved in Wishlist")}
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-[#C32929] mt-1">
                {wishProduct.length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {t("profile.totalSpent", "Total Spent")}
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">
                {currency.format(totalSpent)}
              </p>
            </div>
          </div>

          {/* Mobile-Friendly Scrollable Navigation Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mt-6 mb-5 border-b border-gray-200 no-scrollbar">
            {navTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 min-h-[42px] rounded-t-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? "border-gray-900 text-gray-900 bg-white"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <IconComponent size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Active Deliveries Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    <Truck size={17} className="text-amber-600" />
                    {t("profile.activeDeliveries", "Active Deliveries")} (
                    {activeDeliveries.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleTabChange("orders")}
                    className="text-xs font-bold text-gray-900 underline cursor-pointer"
                  >
                    View All Orders
                  </button>
                </div>
                {activeDeliveries.length > 0 ? (
                  <ProfileOrdersTab
                    orders={activeDeliveries.slice(0, 2)}
                    onCancelOrder={handleCancelCustomerOrder}
                  />
                ) : (
                  <p className="text-xs text-gray-500 py-3">
                    No active deliveries in transit right now.
                  </p>
                )}
              </div>

              {/* Quick Shortcuts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <Link
                  to="/wishlist"
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 text-[#C32929] flex items-center justify-center">
                      <Heart size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-900">
                        My Wishlist
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        {wishProduct.length} saved items
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/discounts"
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                      <ShoppingBag size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-900">
                        Today&apos;s Deals
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        Explore verified discounts
                      </p>
                    </div>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => handleTabChange("addresses")}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-gray-900 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-900">
                        Saved Addresses
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        {addresses.length} delivery locations
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <ProfileOrdersTab
              orders={orders}
              onCancelOrder={handleCancelCustomerOrder}
            />
          )}

          {activeTab === "addresses" && (
            <ProfileAddressesTab
              addresses={addresses}
              newAddress={newAddress}
              setNewAddress={setNewAddress}
              onAddAddress={handleAddAddress}
              onRemoveAddress={handleRemoveAddress}
            />
          )}

          {activeTab === "settings" && (
            <ProfileSettingsTab
              userEmail={user.email}
              displayName={displayName}
              setDisplayName={setDisplayName}
              phone={phone}
              setPhone={setPhone}
              photoURL={photoURL}
              setPhotoURL={setPhotoURL}
              bio={bio}
              setBio={setBio}
              savingProfile={savingProfile}
              onSaveProfile={handleSaveProfile}
            />
          )}
        </div>
      </Container>
    </section>
  );
};

export default ProfilePage;
