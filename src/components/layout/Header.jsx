import React, { useEffect, useMemo, useState } from "react";
import Image from "./common/Image";
import { FaAngleRight } from "react-icons/fa6";
import { IoSearchOutline, IoCloseSharp } from "react-icons/io5";
import { Link, useNavigate } from "react-router";
import navData from "../../api/navbardata.json";
import { useDispatch, useSelector } from "react-redux";
import { onUserChanged } from "../../services/authSession";
import SearchOpan from "./common/SearchOpan";
import { productDetail } from "../../slices/ProductDetailsSlice";
import { Allitem } from "../../slices/AllProductSlice";
import { addProduct, setShopOptions } from "../../slices/productSlice";
import {
  fetchCatalogProducts,
  initStoreConfigSync,
} from "../../services/api";
import {
  getStoredCartRules,
  initCartRulesSync,
} from "../../utils/cartPromotions";
import {
  Heart,
  Search,
  ShoppingBag,
  User as UserIcon,
  ShieldCheck,
} from "lucide-react";

const Header = () => {
  const navigate = useNavigate();
  const [menuActive, setmenuActive] = useState(false);
  const CartProduct = useSelector((state) => state.cart.products);
  const WishProduct = useSelector((state) => state.wishList.wishProduct);
  const [User, setuser] = useState(null);
  const [searchOpen, setsearchOpen] = useState(false);
  const [Input, setInput] = useState("");
  const [cartRules, setCartRules] = useState(() => getStoredCartRules());

  const Alldata = useSelector((state) => state.AllProduct.Products);
  const hasProducts = Boolean(Alldata?.length);
  const dispatch = useDispatch();

  // Load catalog with deduplicated cache + subscribe to live Admin storeConfig updates
  useEffect(() => {
    if (!hasProducts) {
      fetchCatalogProducts(200)
        .then((products) => {
          if (products?.length) {
            dispatch(Allitem(products));
            dispatch(addProduct(products));
          }
        })
        .catch(() => {});
    }

    initStoreConfigSync((updatedCatalog) => {
      dispatch(Allitem(updatedCatalog));
      dispatch(addProduct(updatedCatalog));
    });
  }, [hasProducts, dispatch]);

  const mobileFilteredProducts = useMemo(() => {
    const q = Input.toLowerCase().trim();
    if (!q) return [];
    return (Alldata || [])
      .filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q) ||
          item.brand?.toLowerCase().includes(q) ||
          String(item.sku || "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [Alldata, Input]);

  function handleMobileSelectProduct(product) {
    dispatch(productDetail(product));
    navigate(`/shopsingle?id=${product.id}`);
    setInput("");
    setsearchOpen(false);
    setmenuActive(false);
  }

  function handleMobileSearchSubmit(e) {
    e.preventDefault();
    const q = Input.trim();
    dispatch(setShopOptions({ searchQuery: q }));
    setsearchOpen(false);
    setmenuActive(false);
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  }

  useEffect(() => {
    const unsubscribe = onUserChanged((user) => {
      setuser(user || null);
    });
    const unsubRules = initCartRulesSync((rules) => setCartRules(rules));
    return () => {
      unsubscribe();
      if (typeof unsubRules === "function") unsubRules();
    };
  }, []);

  return (
    <header className="relative z-40 bg-white border-b border-gray-100 md:border-none">
      {/* International Storefront Top Promo Announcement Bar */}
      {(cartRules?.freeShippingEnabled ||
        cartRules?.bogoEnabled ||
        cartRules?.tieredDiscountEnabled) && (
        <div className="bg-primary text-white text-[11px] sm:text-xs font-jost py-2 px-3">
          <div className="container mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-2 text-center">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
              {cartRules?.freeShippingEnabled && (
                <span>
                  🚚 <strong>FREE EXPRESS DELIVERY</strong> on orders over $
                  {Number(cartRules.freeShippingThreshold || 100).toFixed(0)}
                </span>
              )}
              {cartRules?.bogoEnabled && (
                <span className="text-amber-300 font-semibold">
                  🎁 BUY {cartRules.bogoBuyCount || 2} GET{" "}
                  {cartRules.bogoFreeCount || 1} FREE Storewide
                </span>
              )}
              {cartRules?.tieredDiscountEnabled && (
                <span className="hidden lg:inline text-emerald-300">
                  ✨ Spend ${cartRules.tieredMinSpend || 200}+ for Extra{" "}
                  {cartRules.tieredDiscountPercent || 10}% VIP Off
                </span>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[11px] text-gray-300">
              <Link
                to="/shop"
                className="underline hover:text-white font-semibold"
              >
                Shop Deals
              </Link>
              <span>•</span>
              <span>30-Day Worldwide Returns</span>
            </div>
          </div>
        </div>
      )}

      <nav className="md:pt-6 md:pb-6 py-4 md:px-2.5">
        <div className="container hidden md:block">
          <div className="flex items-center">
            <Link to="/">
              <Image src="../images/logo.png" alt="logo" />
            </Link>
            <ul className="lg:ml-14 bmd:ml-10 ml-5 flex gap-5 lg:gap-9">
              {navData?.map((item, id) => (
                <Link key={item.id || id} to={item.path}>
                  <li className='text-primary cursor-pointer after:bg-primary relative text-sm md:text-[12px] lg:text-sm leading-6 font-medium after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:duration-300 after:content-[""] hover:after:w-[70%]'>
                    {item?.title}
                  </li>
                </Link>
              ))}
            </ul>

            {/* Desktop Action Icons */}
            <div className="ml-auto flex items-center gap-5 bmd:gap-7">
              <button
                type="button"
                aria-label="Toggle Search"
                className="cursor-pointer text-primary hover:text-[#B9A16B] transition-colors"
                onClick={() => setsearchOpen(!searchOpen)}
              >
                <Search size={20} />
              </button>

              {User ? (
                <button
                  type="button"
                  title="Customer Dashboard"
                  className="w-7 h-7 rounded-full cursor-pointer overflow-hidden border border-gray-300 flex items-center justify-center bg-gray-100 text-xs font-bold"
                  onClick={() => navigate("/profile")}
                >
                  {User?.photoURL ? (
                    <Image
                      className="w-full h-full object-cover rounded-full"
                      src={User.photoURL}
                      alt="user avatar"
                    />
                  ) : (
                    <span>
                      {(User.displayName || User.email || "U")[0].toUpperCase()}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Login"
                  onClick={() => navigate("/login")}
                  className="cursor-pointer text-primary hover:text-[#B9A16B] transition-colors"
                >
                  <UserIcon size={20} />
                </button>
              )}

              <button
                type="button"
                aria-label="Wishlist"
                className="cursor-pointer relative text-primary hover:text-[#B9A16B] transition-colors"
                onClick={() => navigate("/wishlist")}
              >
                <Heart size={20} />
                <span className="absolute -bottom-1.5 -right-2 bg-[#B9A16B] h-4 w-4 leading-4 rounded-full text-[10px] text-white">
                  {WishProduct.length}
                </span>
              </button>

              <button
                type="button"
                aria-label="Shopping Cart"
                onClick={() => navigate("/cart")}
                className="cursor-pointer relative text-primary hover:text-[#B9A16B] transition-colors"
              >
                <ShoppingBag size={20} />
                <span className="absolute -bottom-1.5 -right-2 bg-[#B9A16B] h-4 w-4 leading-4 rounded-full text-[10px] text-white">
                  {CartProduct.length}
                </span>
              </button>

              <button
                type="button"
                title="Admin Control Panel"
                onClick={() => navigate("/admin")}
                className="cursor-pointer text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ShieldCheck size={19} />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          {searchOpen && (
            <SearchOpan searchOpen={searchOpen} setSearchOpen={setsearchOpen} />
          )}
        </div>

        {/* Mobile Responsive Header */}
        <div className="flex justify-between items-center px-4 md:hidden">
          {menuActive ? (
            <button
              type="button"
              aria-label="Close Menu"
              onClick={() => setmenuActive(false)}
            >
              <IoCloseSharp size={25} />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Open Menu"
              onClick={() => setmenuActive(true)}
            >
              <svg
                width="25"
                height="18"
                viewBox="0 0 25 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="25" height="2" fill="#222222" />
                <rect y="8" width="20" height="2" fill="#222222" />
                <rect y="16" width="25" height="2" fill="#222222" />
              </svg>
            </button>
          )}

          {menuActive && (
            <ul className="z-50 border-t border-gray-200 fixed left-0 right-0 top-14 bottom-0 px-4 pt-5 bg-white overflow-y-auto pb-28 shadow-xl">
              <div>
                <form
                  onSubmit={handleMobileSearchSubmit}
                  className="flex justify-between items-center w-full relative"
                  onClick={() => setsearchOpen(true)}
                >
                  <input
                    value={Input}
                    onChange={(e) => setInput(e.target.value)}
                    type="text"
                    placeholder="Search products, brands, SKU..."
                    className="w-full border-2 border-[#E4E4E4] h-10 pl-3.5 pr-10 mb-4 text-sm outline-none focus:border-primary"
                  />
                  <button type="submit" aria-label="Search">
                    <IoSearchOutline
                      size={20}
                      className="absolute right-3 top-2.5 text-gray-600"
                    />
                  </button>
                </form>

                {searchOpen && Input.trim() !== "" && (
                  <div className="mb-4 border border-gray-200 rounded-md p-2 bg-gray-50 space-y-2">
                    {mobileFilteredProducts.length === 0 ? (
                      <p className="text-xs text-gray-500 p-2">
                        No results found
                      </p>
                    ) : (
                      mobileFilteredProducts.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleMobileSelectProduct(product)}
                          className="flex items-center gap-3 p-1.5 bg-white rounded border border-gray-100 cursor-pointer"
                        >
                          <img
                            src={product.thumbnail}
                            alt={product.title}
                            className="w-10 h-10 object-contain rounded shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-900 truncate">
                              {product.title}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              ${Number(product.price || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {navData?.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setmenuActive(false)}
                >
                  <li className="text-primary leading-11 cursor-pointer text-sm font-medium flex items-center justify-between border-b border-gray-100">
                    {item?.title}
                    <FaAngleRight />
                  </li>
                </Link>
              ))}

              {/* Quick Account & Admin Links on Mobile */}
              <div className="mt-6 pt-4 border-t border-gray-200 space-y-2.5">
                <Link
                  to={User ? "/profile" : "/login"}
                  onClick={() => setmenuActive(false)}
                  className="flex items-center justify-between py-2 text-sm font-medium text-primary"
                >
                  <span className="flex items-center gap-2.5">
                    <UserIcon size={17} />
                    {User ? "MY ACCOUNT & ORDERS" : "LOGIN / REGISTER"}
                  </span>
                  <FaAngleRight />
                </Link>
                <Link
                  to="/wishlist"
                  onClick={() => setmenuActive(false)}
                  className="flex items-center justify-between py-2 text-sm font-medium text-primary"
                >
                  <span className="flex items-center gap-2.5">
                    <Heart size={17} />
                    MY WISHLIST ({WishProduct.length})
                  </span>
                  <FaAngleRight />
                </Link>
                <Link
                  to="/admin"
                  onClick={() => setmenuActive(false)}
                  className="flex items-center justify-between py-2 text-sm font-semibold text-emerald-700"
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck size={17} />
                    ADMIN CONTROL PANEL
                  </span>
                  <FaAngleRight />
                </Link>
              </div>
            </ul>
          )}

          <Link to="/">
            <Image src="../images/logo.png" alt="logo" />
          </Link>

          <div className="flex items-center gap-3.5">
            <button
              type="button"
              aria-label="Admin Panel"
              onClick={() => navigate("/admin")}
              className="text-gray-600"
            >
              <ShieldCheck size={19} />
            </button>
            <button
              type="button"
              aria-label="Shopping Cart"
              className="relative"
              onClick={() => navigate("/cart")}
            >
              <ShoppingBag size={20} />
              <span className="block size-4 bg-[#b9a16b] rounded-full text-[10px] font-medium absolute -right-2 -bottom-2 text-white">
                {CartProduct.length}
              </span>
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
