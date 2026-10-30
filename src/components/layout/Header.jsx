import React, { useEffect, useState } from "react";
import Container from "./common/Container";
import Flex from "./common/Flex";
import Image from "./common/Image";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { HiOutlineBars3CenterLeft } from "react-icons/hi2";
import { IoIosSearch } from "react-icons/io";
import {
  ChevronDown,
  ChevronRight,
  Flame,
  Globe,
  Heart,
  HelpCircle,
  Home,
  LogOut,
  Mail,
  Package,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { MdOutlineDeleteForever } from "react-icons/md";
import {
  clearSessionUser,
  onUserChanged,
} from "../../services/authSession";
import {
  fetchCatalogProducts,
  getInitialCatalogSnapshot,
  initStoreConfigSync,
} from "../../services/api";
import { RemoveItem } from "../../slices/cartSlice";
import { getProductDiscountState } from "../../utils/discountTimer";
import { useLocalization } from "../../i18n/LocalizationContext";

const Logo = "/images/logo.png";

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, toggleLang, t } = useLocalization();

  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [addCart, setAddCart] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedDept, setExpandedDept] = useState("");
  const [products, setProducts] = useState(() => getInitialCatalogSnapshot());
  const [searchValue, setSearchValue] = useState("");
  const [searchData, setSearchData] = useState([]);

  const data = useSelector(
    (state) => state.cart.products || state.cart.cart || []
  );
  const wishProduct = useSelector((state) => state.wishList.wishProduct || []);

  const totalCartItems = data.reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity || item.qun || 1)),
    0
  );

  // Close mobile drawer, cart drawer, and search popup on route change
  useEffect(() => {
    setOpen(false);
    setAddCart(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  // Body scroll lock & notify MobileBottomNav when mobile drawer or cart drawer is open
  useEffect(() => {
    const anyDrawerOpen = Boolean(open || addCart);
    if (typeof document !== "undefined") {
      document.body.style.overflow = anyDrawerOpen ? "hidden" : "";
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
      }
    };
  }, [open, addCart]);

  // Close drawers on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setAddCart(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    fetchCatalogProducts(200).then((items) => {
      if (active) setProducts(items);
    });
    const unsubSync = initStoreConfigSync((updatedCatalog) => {
      if (active && Array.isArray(updatedCatalog)) {
        setProducts(updatedCatalog);
      }
    });
    return () => {
      active = false;
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
    const filterData = products
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

  const subtotalAmount = data.reduce((total, current) => {
    const unitPrice = getProductDiscountState(current).effectivePrice;
    return (
      total +
      unitPrice * Math.max(1, Number(current.quantity || current.qun || 1))
    );
  }, 0);

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
    { slug: "beauty", label: t("nav.beauty", "Beauty & Care"), path: "/category/beauty" },
    { slug: "fragrances", label: t("nav.fragrances", "Fragrances"), path: "/category/fragrances" },
    { slug: "electronics", label: t("nav.electronics", "Electronics & Gadgets"), path: "/category/electronics" },
    { slug: "home-living", label: t("nav.homeLiving", "Home & Living"), path: "/category/home-living" },
    { slug: "sports", label: t("nav.sports", "Sports & Outdoors"), path: "/category/sports" },
    { slug: "groceries", label: t("nav.groceries", "Groceries & Essentials"), path: "/category/groceries" },
  ];

  return (
    <header className="py-3 lg:py-6 border-b border-[#eee] sticky top-0 z-40 bg-white/95 backdrop-blur-md">
      <Container>
        {/* ==================== DESKTOP NAVIGATION (>= 1024px) ==================== */}
        <Flex className="justify-between items-center hidden lg:flex px-4">
          <Flex className="gap-8 xl:gap-11 items-center">
            <Link to="/" aria-label="UOMO Storefront Home" className="shrink-0">
              <Image
                src={Logo}
                alt="UOMO Logo"
                width={112}
                height={28}
                className="h-7 w-auto"
              />
            </Link>
            <nav aria-label="Main desktop navigation">
              <ul className="flex gap-5 xl:gap-7 items-center">
                <li>
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      `text-[13px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                        isActive
                          ? "text-gray-900 border-b-2 border-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`
                    }
                  >
                    {t("nav.home", "Home")}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/shop"
                    className={({ isActive }) =>
                      `text-[13px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                        isActive
                          ? "text-gray-900 border-b-2 border-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`
                    }
                  >
                    {t("nav.shop", "Shop")}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/category/men"
                    className={({ isActive }) =>
                      `text-[13px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                        isActive
                          ? "text-gray-900 border-b-2 border-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`
                    }
                  >
                    {t("dept.men", "Men")}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/category/women"
                    className={({ isActive }) =>
                      `text-[13px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                        isActive
                          ? "text-gray-900 border-b-2 border-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`
                    }
                  >
                    {t("dept.women", "Women")}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/category/kids"
                    className={({ isActive }) =>
                      `text-[13px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                        isActive
                          ? "text-gray-900 border-b-2 border-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`
                    }
                  >
                    {t("dept.kids", "Kids")}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/discounts"
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider py-1.5 px-2.5 rounded-full transition-colors ${
                        isActive
                          ? "bg-[#C32929] text-white"
                          : "text-[#C32929] bg-red-50 hover:bg-red-100"
                      }`
                    }
                  >
                    <Flame size={13} />
                    {t("nav.allDiscounts", "Discounts")}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/blog"
                    className={({ isActive }) =>
                      `text-[13px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                        isActive
                          ? "text-gray-900 border-b-2 border-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`
                    }
                  >
                    {t("nav.journal", "Journal")}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/contact"
                    className={({ isActive }) =>
                      `text-[13px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                        isActive
                          ? "text-gray-900 border-b-2 border-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`
                    }
                  >
                    {t("nav.contact", "Contact")}
                  </NavLink>
                </li>
              </ul>
            </nav>
          </Flex>

          {/* Desktop Right Utilities */}
          <Flex className="gap-4 items-center">
            {/* Language Switcher EN / বাংলা */}
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-gray-200 hover:border-gray-900 text-xs font-bold text-gray-800 transition-colors cursor-pointer"
              title="Switch language between English and Bangla"
            >
              <Globe size={14} className="text-gray-600" />
              <span>{lang === "bn" ? "বাংলা" : "EN"}</span>
            </button>

            {/* Desktop Search */}
            <div className="relative">
              <button
                type="button"
                aria-label="Toggle product search"
                onClick={() => setSearchOpen((prev) => !prev)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <IoIosSearch className="text-2xl text-gray-900" />
              </button>
              {searchOpen && (
                <div className="absolute right-0 top-12 z-50 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl p-4">
                  <form onSubmit={handleSearchSubmit} className="relative">
                    <input
                      value={searchValue}
                      onChange={handleSearchInput}
                      className="w-full py-2.5 pl-3.5 pr-10 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900"
                      type="text"
                      placeholder={t("nav.searchPlaceholder", "Search products...")}
                      autoFocus
                    />
                    <button
                      type="submit"
                      aria-label="Submit search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                    >
                      <IoIosSearch className="text-xl" />
                    </button>
                  </form>
                  {searchData.length > 0 && (
                    <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-gray-100">
                      {searchData.map((item) => {
                        const ds = getProductDiscountState(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchValue("");
                              setSearchData([]);
                              navigate(`/shop/${item.id}`);
                            }}
                            className="w-full flex items-center gap-3 py-2.5 px-2 hover:bg-gray-50 text-left rounded-lg transition-colors cursor-pointer"
                          >
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-11 h-11 rounded object-cover bg-gray-100 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-900 truncate">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-bold text-gray-900">
                                  ${ds.effectivePrice.toFixed(2)}
                                </span>
                                {ds.isDiscountActive && (
                                  <span className="text-[11px] text-gray-400 line-through">
                                    ${ds.regularPrice.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Profile / Sign In */}
            {user ? (
              <button
                type="button"
                aria-label="Open My Account"
                onClick={() => navigate("/profile")}
                className="w-8 h-8 rounded-full overflow-hidden border border-gray-300 cursor-pointer hover:ring-2 hover:ring-gray-900 transition-all"
              >
                <Image
                  className="w-full h-full object-cover"
                  src={user?.photoURL}
                  alt={user?.displayName || "Account"}
                />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Sign in to account"
                onClick={() => navigate("/login")}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer text-gray-900"
              >
                <UserIcon size={20} />
              </button>
            )}

            {/* Wishlist */}
            <button
              type="button"
              aria-label={`View Wishlist (${wishProduct.length})`}
              onClick={() => navigate("/wishlist")}
              className="relative p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer text-gray-900"
            >
              <Heart size={20} />
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 bg-[#B9A16B] h-4 min-w-[16px] px-1 leading-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
              >
                {wishProduct.length}
              </span>
            </button>

            {/* Cart Drawer Trigger */}
            <button
              type="button"
              aria-label={`Open Shopping Bag (${totalCartItems})`}
              onClick={() => setAddCart(true)}
              className="relative p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer text-gray-900"
            >
              <ShoppingBag size={20} />
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 bg-gray-900 h-4 min-w-[16px] px-1 leading-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
              >
                {totalCartItems}
              </span>
            </button>
          </Flex>
        </Flex>

        {/* ==================== MOBILE & TABLET HEADER (< 1024px) ==================== */}
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
            <button
              type="button"
              onClick={toggleLang}
              title="Switch language between English and Bangla"
              className="px-2 py-1 rounded-md border border-gray-200 text-[11px] font-bold text-gray-800 bg-gray-50 active:bg-gray-100 cursor-pointer"
            >
              {lang === "bn" ? "EN" : "বাংলা"}
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
              onClick={() => setAddCart(true)}
              className="relative min-w-[44px] min-h-[44px] -mr-1 flex items-center justify-center rounded-lg text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <ShoppingBag size={21} />
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-1.5 bg-[#C32929] h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none"
              >
                {totalCartItems}
              </span>
            </button>
          </div>
        </div>
      </Container>

      {/* ==================== SLIDE-OUT MOBILE NAVIGATION DRAWER ==================== */}
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile store navigation"
        >
          {/* Dimmed Backdrop */}
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/55 backdrop-blur-[1px] transition-opacity"
          />

          {/* Slide-Out Drawer Panel (Never full width: w-[86vw] max-w-[320px] h-[100dvh]) */}
          <aside className="fixed top-0 left-0 bottom-0 z-50 w-[86vw] max-w-[320px] h-[100dvh] bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2"
              >
                <Image
                  src={Logo}
                  alt="UOMO Logo"
                  width={96}
                  height={24}
                  className="h-6 w-auto"
                />
              </Link>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleLang}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-300 text-xs font-bold text-gray-800 bg-gray-50 cursor-pointer"
                >
                  <Globe size={13} />
                  <span>{lang === "bn" ? "English" : "বাংলা"}</span>
                </button>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setOpen(false)}
                  className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Mobile Drawer Search Box */}
            <div className="p-3.5 border-b border-gray-100 bg-gray-50/70 shrink-0">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="search"
                  value={searchValue}
                  onChange={handleSearchInput}
                  placeholder={t("nav.searchPlaceholder", "Search products...")}
                  className="w-full h-10 pl-3.5 pr-9 rounded-lg border border-gray-300 bg-white text-xs text-gray-900 outline-none focus:border-gray-900"
                />
                <button
                  type="submit"
                  aria-label="Search catalog"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                >
                  <IoIosSearch className="text-lg" />
                </button>
              </form>
              {searchData.length > 0 && (
                <div className="mt-2 bg-white border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-100 shadow-lg">
                  {searchData.map((item) => {
                    const ds = getProductDiscountState(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setSearchValue("");
                          setSearchData([]);
                          navigate(`/shop/${item.id}`);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 hover:bg-gray-50 text-left"
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-9 h-9 rounded object-cover bg-gray-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] font-bold text-[#C32929]">
                            ${ds.effectivePrice.toFixed(2)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-100">
              {/* Primary Storefront Links */}
              <div className="py-2 px-2">
                <NavLink
                  to="/"
                  end
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "text-gray-900 hover:bg-gray-100"
                    }`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Home size={17} />
                    {t("nav.home", "Home")}
                  </span>
                  <ChevronRight size={15} className="opacity-60" />
                </NavLink>

                <NavLink
                  to="/shop"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-semibold mt-0.5 transition-colors ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "text-gray-900 hover:bg-gray-100"
                    }`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles size={17} />
                    {t("nav.shopAll", "Shop All")}
                  </span>
                  <ChevronRight size={15} className="opacity-60" />
                </NavLink>

                <NavLink
                  to="/discounts"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-bold mt-1 transition-colors ${
                      isActive
                        ? "bg-[#C32929] text-white"
                        : "bg-red-50 text-[#C32929] hover:bg-red-100"
                    }`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Flame size={17} />
                    {t("nav.allDiscounts", "All Discounts")}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C32929] text-white">
                    HOT
                  </span>
                </NavLink>
              </div>

              {/* Primary Fashion Departments (Men, Women, Kids) */}
              <div className="py-3 px-2">
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {t("nav.departments", "Shop by Department")}
                </p>
                {primaryDepartments.map((dept) => {
                  const isExpanded = expandedDept === dept.slug;
                  return (
                    <div key={dept.slug} className="mb-1">
                      <div className="flex items-center justify-between rounded-lg hover:bg-gray-50">
                        <Link
                          to={dept.path}
                          onClick={() => setOpen(false)}
                          className="flex-1 flex items-center px-3 min-h-[44px] text-sm font-semibold text-gray-900"
                        >
                          {dept.label}
                        </Link>
                        <button
                          type="button"
                          aria-label={`Toggle ${dept.label} subcategories`}
                          onClick={() =>
                            setExpandedDept(isExpanded ? "" : dept.slug)
                          }
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-900 cursor-pointer"
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="pl-5 pr-2 pb-2 flex flex-wrap gap-1.5">
                          {dept.subcategories.map((sub) => (
                            <Link
                              key={sub}
                              to={`${dept.path}?sub=${encodeURIComponent(sub)}`}
                              onClick={() => setOpen(false)}
                              className="px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-900 hover:text-white text-xs font-medium text-gray-700 transition-colors"
                            >
                              {sub}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* More Lifestyle & Catalog Departments */}
              <div className="py-3 px-2">
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {t("nav.moreCategories", "More Departments")}
                </p>
                <div className="grid grid-cols-1 gap-0.5">
                  {secondaryDepartments.map((dept) => (
                    <Link
                      key={dept.slug}
                      to={dept.path}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between px-3 min-h-[42px] rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <span>{dept.label}</span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Customer Account, Orders, Wishlist, Cart & Help */}
              <div className="py-3 px-2">
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {t("nav.customerCare", "Customer Care & Account")}
                </p>
                <Link
                  to="/wishlist"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-2.5">
                    <Heart size={16} className="text-gray-600" />
                    {t("nav.wishlist", "Wishlist")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                    {wishProduct.length}
                  </span>
                </Link>
                <Link
                  to="/cart"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingBag size={16} className="text-gray-600" />
                    {t("nav.cart", "Shopping Bag")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-900 text-white">
                    {totalCartItems}
                  </span>
                </Link>
                <Link
                  to={user ? "/profile" : "/login"}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-2.5">
                    <UserIcon size={16} className="text-gray-600" />
                    {t("nav.myAccount", "My Account")}
                  </span>
                  <ChevronRight size={14} className="text-gray-400" />
                </Link>
                <Link
                  to={user ? "/profile?tab=orders" : "/login"}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-2.5">
                    <Package size={16} className="text-gray-600" />
                    {t("nav.myOrders", "My Orders")}
                  </span>
                  <ChevronRight size={14} className="text-gray-400" />
                </Link>
                <Link
                  to="/faq"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-2.5">
                    <HelpCircle size={16} className="text-gray-600" />
                    {t("nav.helpFaq", "Help / FAQ")}
                  </span>
                  <ChevronRight size={14} className="text-gray-400" />
                </Link>
                <Link
                  to="/contact"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-2.5">
                    <Mail size={16} className="text-gray-600" />
                    {t("nav.contact", "Contact Us")}
                  </span>
                  <ChevronRight size={14} className="text-gray-400" />
                </Link>
              </div>
            </div>

            {/* Sticky Drawer Footer (Customer Auth State) */}
            <div className="p-3.5 border-t border-gray-200 bg-gray-50 shrink-0 safe-area-bottom">
              {user ? (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate("/profile");
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      className="w-9 h-9 rounded-full object-cover border border-gray-300 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {user.displayName || user.username || "Customer"}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {user.email}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 px-3 min-h-[38px] rounded-lg border border-gray-300 bg-white text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                  >
                    <LogOut size={14} />
                    <span>{t("nav.signOut", "Sign Out")}</span>
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="w-full min-h-[44px] rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                >
                  <UserIcon size={15} />
                  <span>{t("nav.signIn", "Sign In / Register")}</span>
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ==================== SLIDE-OUT SHOPPING BAG DRAWER ==================== */}
      {addCart && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping bag"
        >
          <div
            onClick={() => setAddCart(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
          />
          <aside className="fixed top-0 right-0 bottom-0 z-50 w-[90vw] max-w-[400px] h-[100dvh] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200 shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                {t("nav.cart", "Shopping Bag")} ({totalCartItems})
              </h3>
              <button
                type="button"
                aria-label="Close shopping bag"
                onClick={() => setAddCart(false)}
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-200 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-gray-100">
              {data.length > 0 ? (
                data.map((item) => {
                  const ds = getProductDiscountState(item);
                  const qty = Math.max(1, Number(item.quantity || item.qun || 1));
                  return (
                    <div
                      key={
                        item.cartLineId ||
                        `${item.id}-${item.selectedSize || ""}-${item.selectedColor || ""}`
                      }
                      className="py-3.5 flex gap-3 items-start"
                    >
                      <img
                        src={item.thumbnail || item.image}
                        alt={item.title}
                        className="w-16 h-16 rounded-lg object-cover bg-gray-100 border border-gray-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-gray-900 line-clamp-1">
                            {item.title}
                          </h4>
                          <button
                            type="button"
                            aria-label={`Remove ${item.title}`}
                            onClick={() => handleDeleteCartItem(item)}
                            className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                          >
                            <MdOutlineDeleteForever className="text-lg" />
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Qty: <strong className="text-gray-800">{qty}</strong>
                          {item.selectedSize ? ` • Size: ${item.selectedSize}` : ""}
                          {item.selectedColor ? ` • Color: ${item.selectedColor}` : ""}
                        </p>
                        {(item.optionalMessage || item.specialNote) && (
                          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mt-1 line-clamp-1">
                            Note: {item.optionalMessage || item.specialNote}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs font-bold text-gray-900">
                            ${(ds.effectivePrice * qty).toFixed(2)}
                          </span>
                          {ds.isDiscountActive && (
                            <span className="text-[11px] text-gray-400 line-through">
                              ${(ds.regularPrice * qty).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center">
                  <ShoppingBag
                    size={36}
                    className="mx-auto text-gray-300 mb-3"
                  />
                  <p className="text-sm font-semibold text-gray-700">
                    Your shopping bag is empty
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAddCart(false);
                      navigate("/shop");
                    }}
                    className="mt-4 px-5 py-2.5 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer"
                  >
                    {t("nav.shopAll", "Explore Collection")}
                  </button>
                </div>
              )}
            </div>

            {data.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0 safe-area-bottom">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Subtotal
                  </span>
                  <span className="text-base font-extrabold text-gray-900">
                    ${subtotalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    to="/cart"
                    onClick={() => setAddCart(false)}
                    className="min-h-[44px] rounded-lg border border-gray-900 bg-white text-gray-900 text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-gray-100 transition-colors"
                  >
                    View Cart
                  </Link>
                  <Link
                    to="/billing"
                    onClick={() => setAddCart(false)}
                    className="min-h-[44px] rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-gray-800 transition-colors"
                  >
                    Checkout
                  </Link>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </header>
  );
};

export default Header;
