import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { HiOutlineBars3CenterLeft } from "react-icons/hi2";
import { Flame, ShoppingBag } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import Container from "./common/Container";
import Image from "./common/Image";
import DesktopNavbar from "./header/DesktopNavbar";
import MobileNavDrawer from "./header/MobileNavDrawer";
import SlideOverCartDrawer from "./header/SlideOverCartDrawer";
import { clearSessionUser, onUserChanged } from "../../services/authSession";
import {
  fetchCatalogProducts,
  getInitialCatalogSnapshot,
  initStoreConfigSync,
} from "../../services/api";
import {
  CART_DRAWER_OPEN_EVENT,
  RemoveItem,
} from "../../slices/cartSlice";
import { resolveCartItemPricing } from "../../utils/cartPromotions";
import { useLocalization } from "../../i18n/LocalizationContext";

const Logo = "/images/logo.png";

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLocalization();

  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [addCart, setAddCart] = useState(false);
  const [cartAnnouncement, setCartAnnouncement] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedDept, setExpandedDept] = useState("");
  const [products, setProducts] = useState(() => getInitialCatalogSnapshot());
  const [searchValue, setSearchValue] = useState("");
  const [searchData, setSearchData] = useState([]);
  const lastTriggerRef = useRef(null);

  const data = useSelector(
    (state) => state.cart.products || state.cart.cart || []
  );
  const reduxCatalog = useSelector((state) => state.AllProduct.Products);
  const wishProduct = useSelector((state) => state.wishList.wishProduct || []);

  const effectiveCatalog =
    Array.isArray(reduxCatalog) && reduxCatalog.length > 0
      ? reduxCatalog
      : products;

  const totalCartItems = data.reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity || item.qun || 1)),
    0
  );

  const openCartDrawerWithFocusSave = useCallback(() => {
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      lastTriggerRef.current = document.activeElement;
    }
    setAddCart(true);
  }, []);

  const closeCartDrawerAndRestoreFocus = useCallback(() => {
    setAddCart(false);
    const prevEl = lastTriggerRef.current;
    if (
      prevEl &&
      typeof prevEl.focus === "function" &&
      typeof document !== "undefined" &&
      document.contains(prevEl)
    ) {
      requestAnimationFrame(() => {
        try {
          prevEl.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      });
    }
  }, []);

  useEffect(() => {
    setOpen(false);
    setAddCart(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleOpenCartEvent = (e) => {
      if (
        typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
      ) {
        lastTriggerRef.current = document.activeElement;
      }
      const detail = e?.detail || {};
      if (detail.title) {
        const qty = Number(detail.quantity || 0);
        const variant = [detail.size, detail.color].filter(Boolean).join(", ");
        setCartAnnouncement(
          qty > 0
            ? `Added ${qty} ${detail.title}${variant ? ` (${variant})` : ""} to shopping bag.`
            : `Shopping bag opened for ${detail.title}.`
        );
      }
      setAddCart(true);
    };

    window.addEventListener(CART_DRAWER_OPEN_EVENT, handleOpenCartEvent);
    return () => {
      window.removeEventListener(CART_DRAWER_OPEN_EVENT, handleOpenCartEvent);
    };
  }, []);

  useEffect(() => {
    const anyDrawerOpen = Boolean(open || addCart);
    if (typeof document !== "undefined") {
      document.body.style.overflow = anyDrawerOpen ? "hidden" : "";
      document.body.style.overscrollBehavior = anyDrawerOpen ? "contain" : "";
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ummo:mobile-drawer-toggle", {
          detail: { open: anyDrawerOpen },
        })
      );
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
        document.body.style.overscrollBehavior = "";
      }
    };
  }, [open, addCart]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearchOpen(false);
        if (addCart) {
          closeCartDrawerAndRestoreFocus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addCart, closeCartDrawerAndRestoreFocus]);

  useEffect(() => {
    let active = true;
    let unsubSync = () => {};
    const timer = setTimeout(() => {
      if (!active) return;
      fetchCatalogProducts(200).then((items) => {
        if (active) setProducts(items);
      });
      unsubSync = initStoreConfigSync((updatedCatalog) => {
        if (active && Array.isArray(updatedCatalog)) {
          setProducts(updatedCatalog);
        }
      });
    }, 2500);
    return () => {
      active = false;
      clearTimeout(timer);
      unsubSync();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onUserChanged((u) => {
      setUser(u || null);
    });
    return () => unsubscribe();
  }, []);

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchValue(val);
    if (!val.trim()) {
      setSearchData([]);
      return;
    }
    const q = val.toLowerCase().trim();
    const filterData = effectiveCatalog
      .filter(
        (item) =>
          item.isVisible !== false &&
          item.status !== "draft" &&
          (item.title?.toLowerCase().includes(q) ||
            item.category?.toLowerCase().includes(q) ||
            item.department?.toLowerCase().includes(q) ||
            item.brand?.toLowerCase().includes(q))
      )
      .slice(0, 8);
    setSearchData(filterData);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    setOpen(false);
    setSearchOpen(false);
    navigate(`/shop?q=${encodeURIComponent(q)}`);
  };

  const handleDeleteCartItem = (item) => {
    dispatch(RemoveItem(typeof item === "object" ? item : { id: item }));
  };

  const handleSignOut = async () => {
    await clearSessionUser();
    setOpen(false);
    navigate("/");
  };

  const subtotalAmount = Number(
    data
      .reduce((total, current) => {
        const pricing = resolveCartItemPricing(current, effectiveCatalog);
        const qty = Math.max(1, Number(current.quantity || current.qun || 1));
        return total + pricing.unitPrice * qty;
      }, 0)
      .toFixed(2)
  );

  const primaryDepartments = [
    {
      slug: "men",
      label: t("nav.mensFashion", "Men's Fashion"),
      path: "/category/men",
      subcategories: ["Clothing", "Shoes", "Accessories", "Watches"],
    },
    {
      slug: "women",
      label: t("nav.womensFashion", "Women's Fashion"),
      path: "/category/women",
      subcategories: ["Clothing", "Shoes", "Bags", "Accessories", "Beauty"],
    },
    {
      slug: "kids",
      label: t("nav.kidsCollection", "Kids' Collection"),
      path: "/category/kids",
      subcategories: ["Boys", "Girls", "Clothing"],
    },
  ];

  const secondaryDepartments = [
    {
      slug: "beauty",
      label: t("nav.beauty", "Beauty & Care"),
      path: "/category/beauty",
    },
    {
      slug: "fragrances",
      label: t("nav.fragrances", "Fragrances"),
      path: "/category/fragrances",
    },
    {
      slug: "electronics",
      label: t("nav.electronics", "Electronics & Gadgets"),
      path: "/category/electronics",
    },
    {
      slug: "home-living",
      label: t("nav.homeLiving", "Home & Living"),
      path: "/category/home-living",
    },
    {
      slug: "sports",
      label: t("nav.sports", "Sports & Outdoors"),
      path: "/category/sports",
    },
    {
      slug: "groceries",
      label: t("nav.groceries", "Groceries & Essentials"),
      path: "/category/groceries",
    },
  ];

  return (
    <>
      <header className="py-3 lg:py-6 border-b border-[#eee] sticky top-0 z-40 bg-white/95 backdrop-blur-md">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {cartAnnouncement}
        </div>

      <Container>
        <DesktopNavbar
          t={t}
          user={user}
          wishCount={wishProduct.length}
          totalCartItems={totalCartItems}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          searchData={searchData}
          setSearchData={setSearchData}
          onSearchInput={handleSearchInput}
          onSearchSubmit={handleSearchSubmit}
          onOpenCart={openCartDrawerWithFocusSave}
          navigate={navigate}
        />

        {/* Mobile & Tablet Header (< 1024px) */}
        <div className="flex lg:hidden items-center justify-between px-3 min-h-[48px]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="min-w-[44px] min-h-[44px] -ml-1 flex items-center justify-center rounded-lg text-gray-900 hover:bg-gray-100 active:bg-gray-200 transition-colors cursor-pointer"
            >
              <HiOutlineBars3CenterLeft className="text-[26px]" />
            </button>
          </div>

          <Link to="/" aria-label="UOMO Storefront Home" className="shrink-0">
            <Image
              src={Logo}
              alt="UOMO Logo"
              width={102}
              height={25}
              className="h-6 w-auto"
            />
          </Link>

          <div className="flex items-center gap-1">
            <Link
              to="/discounts"
              aria-label="View Today's Discounts"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#C32929] hover:bg-red-50 transition-colors"
            >
              <Flame size={20} />
            </Link>
            <button
              type="button"
              aria-label={`Open Shopping Bag (${totalCartItems})`}
              onClick={openCartDrawerWithFocusSave}
              className="relative min-w-[44px] min-h-[44px] -mr-1 flex items-center justify-center rounded-lg text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <ShoppingBag size={21} />
              <span
                aria-hidden="true"
                data-testid="mobile-header-cart-count"
                className="absolute top-1.5 right-1.5 bg-[#C32929] h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none"
              >
                {totalCartItems}
              </span>
            </button>
          </div>
        </div>
      </Container>
      </header>

      {open && (
        <MobileNavDrawer
          t={t}
          user={user}
          wishCount={wishProduct.length}
          totalCartItems={totalCartItems}
          expandedDept={expandedDept}
          setExpandedDept={setExpandedDept}
          primaryDepartments={primaryDepartments}
          secondaryDepartments={secondaryDepartments}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          searchData={searchData}
          setSearchData={setSearchData}
          onSearchInput={handleSearchInput}
          onSearchSubmit={handleSearchSubmit}
          onClose={() => setOpen(false)}
          onSignOut={handleSignOut}
          navigate={navigate}
        />
      )}

      {addCart && (
        <SlideOverCartDrawer
          t={t}
          items={data}
          catalogProducts={effectiveCatalog}
          totalCartItems={totalCartItems}
          subtotalAmount={subtotalAmount}
          announcement={cartAnnouncement}
          onDeleteItem={handleDeleteCartItem}
          onClose={closeCartDrawerAndRestoreFocus}
          navigate={navigate}
        />
      )}
    </>
  );
};

export default Header;
