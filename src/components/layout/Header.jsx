import React, { useEffect, useState } from "react";
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
import { RemoveItem } from "../../slices/cartSlice";
import { getProductDiscountState } from "../../utils/discountTimer";
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

  useEffect(() => {
    setOpen(false);
    setAddCart(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

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
    <header className="py-3 lg:py-6 border-b border-[#eee] sticky top-0 z-40 bg-white/95 backdrop-blur-md">
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
          onOpenCart={() => setAddCart(true)}
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
          totalCartItems={totalCartItems}
          subtotalAmount={subtotalAmount}
          onDeleteItem={handleDeleteCartItem}
          onClose={() => setAddCart(false)}
          navigate={navigate}
        />
      )}
    </header>
  );
};

export default Header;
