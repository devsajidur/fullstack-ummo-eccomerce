import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { Home, ShoppingBag, Heart, User, Grid } from "lucide-react";
import { onUserChanged } from "../../services/authSession";
import { useLocalization } from "../../i18n/LocalizationContext";

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLocalization();

  const cartItems = useSelector(
    (state) => state.cart.products || state.cart.cart || []
  );
  const wishItems = useSelector((state) => state.wishList.wishProduct || []);
  const [user, setUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const unsub = onUserChanged((u) => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleDrawerToggle = (e) => {
      setDrawerOpen(Boolean(e?.detail?.open));
    };
    window.addEventListener("ummo:mobile-drawer-toggle", handleDrawerToggle);
    return () =>
      window.removeEventListener(
        "ummo:mobile-drawer-toggle",
        handleDrawerToggle
      );
  }, []);

  const pathname = location.pathname || "/";
  // Do not show customer bottom navigation on /admin or when a mobile drawer is open
  if (pathname.startsWith("/admin") || drawerOpen) {
    return null;
  }

  const totalCartQty = cartItems.reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity || item.qun || 1)),
    0
  );
  const totalWishQty = wishItems.length;

  const isHome = pathname === "/";
  const isShop =
    pathname.startsWith("/shop") ||
    pathname.startsWith("/category") ||
    pathname.startsWith("/discounts") ||
    pathname.startsWith("/collection");
  const isCart =
    pathname.startsWith("/cart") || pathname.startsWith("/billing");
  const isWishlist =
    pathname.startsWith("/wishlist") || pathname.startsWith("/wish");
  const isAccount =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  const tabs = [
    {
      id: "home",
      label: t("nav.bottom.home", "Home"),
      icon: Home,
      active: isHome,
      badge: 0,
      onClick: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        navigate("/");
      },
    },
    {
      id: "shop",
      label: t("nav.bottom.shop", "Shop"),
      icon: Grid,
      active: isShop,
      badge: 0,
      onClick: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        navigate("/shop");
      },
    },
    {
      id: "cart",
      label: t("nav.bottom.cart", "Cart"),
      icon: ShoppingBag,
      active: isCart,
      badge: totalCartQty,
      onClick: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        navigate("/cart");
      },
    },
    {
      id: "wishlist",
      label: t("nav.bottom.wishlist", "Wishlist"),
      icon: Heart,
      active: isWishlist,
      badge: totalWishQty,
      onClick: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        navigate("/wishlist");
      },
    },
    {
      id: "account",
      label: t("nav.bottom.account", "Account"),
      icon: User,
      active: isAccount,
      badge: 0,
      onClick: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        navigate(user ? "/profile" : "/login");
      },
    },
  ];

  return (
    <nav
      aria-label="Mobile customer navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] safe-area-bottom"
    >
      <div className="grid grid-cols-5 items-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              aria-current={tab.active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center min-h-[56px] py-1.5 px-1 transition-colors cursor-pointer ${
                tab.active
                  ? "text-gray-900 font-bold"
                  : "text-gray-500 hover:text-gray-800 font-medium"
              }`}
            >
              {tab.active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 bg-gray-900 rounded-full" />
              )}
              <div className="relative">
                <IconComponent
                  size={19}
                  strokeWidth={tab.active ? 2.4 : 1.9}
                />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#C32929] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
