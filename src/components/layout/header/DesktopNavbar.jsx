import React from "react";
import { Link, NavLink } from "react-router";
import { IoIosSearch } from "react-icons/io";
import { Flame, Heart, ShoppingBag, User as UserIcon } from "lucide-react";
import Flex from "../common/Flex";
import Image from "../common/Image";
import { getProductDiscountState } from "../../../utils/discountTimer";

const Logo = "/images/logo.png";

export default function DesktopNavbar({
  t,
  user,
  wishCount,
  totalCartItems,
  searchOpen,
  setSearchOpen,
  searchValue,
  setSearchValue,
  searchData,
  setSearchData,
  onSearchInput,
  onSearchSubmit,
  onOpenCart,
  navigate,
}) {
  return (
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

      <Flex className="gap-4 items-center">
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
              <form onSubmit={onSearchSubmit} className="relative">
                <input
                  value={searchValue}
                  onChange={onSearchInput}
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

        <button
          type="button"
          aria-label={`View Wishlist (${wishCount})`}
          onClick={() => navigate("/wishlist")}
          className="relative p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer text-gray-900"
        >
          <Heart size={20} />
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 bg-[#B9A16B] h-4 min-w-[16px] px-1 leading-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
          >
            {wishCount}
          </span>
        </button>

        <button
          type="button"
          aria-label={`Open Shopping Bag (${totalCartItems})`}
          onClick={onOpenCart}
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
  );
}
