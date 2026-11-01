import React from "react";
import { Link, NavLink } from "react-router";
import { IoIosSearch } from "react-icons/io";
import {
  ChevronDown,
  ChevronRight,
  Flame,
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
import Image from "../common/Image";
import { getProductDiscountState } from "../../../utils/discountTimer";

const Logo = "/images/logo.png";

export default function MobileNavDrawer({
  t,
  user,
  wishCount,
  totalCartItems,
  expandedDept,
  setExpandedDept,
  primaryDepartments,
  secondaryDepartments,
  searchValue,
  setSearchValue,
  searchData,
  setSearchData,
  onSearchInput,
  onSearchSubmit,
  onClose,
  onSignOut,
  navigate,
}) {
  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile store navigation"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-[1px] transition-opacity"
      />

      <aside className="fixed top-0 left-0 bottom-0 z-50 w-[86vw] max-w-[320px] h-[100dvh] bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <Link to="/" onClick={onClose} className="flex items-center gap-2">
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
              aria-label="Close navigation menu"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="p-3.5 border-b border-gray-100 bg-gray-50/70 shrink-0">
          <form onSubmit={onSearchSubmit} className="relative">
            <input
              type="search"
              value={searchValue}
              onChange={onSearchInput}
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
                      onClose();
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

        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-100">
          <div className="py-2 px-2">
            <NavLink
              to="/"
              end
              onClick={onClose}
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
              onClick={onClose}
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
              onClick={onClose}
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
                      onClick={onClose}
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
                          onClick={onClose}
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

          <div className="py-3 px-2">
            <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {t("nav.moreCategories", "More Departments")}
            </p>
            <div className="grid grid-cols-1 gap-0.5">
              {secondaryDepartments.map((dept) => (
                <Link
                  key={dept.slug}
                  to={dept.path}
                  onClick={onClose}
                  className="flex items-center justify-between px-3 min-h-[42px] rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  <span>{dept.label}</span>
                  <ChevronRight size={14} className="text-gray-400" />
                </Link>
              ))}
            </div>
          </div>

          <div className="py-3 px-2">
            <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {t("nav.customerCare", "Customer Care & Account")}
            </p>
            <Link
              to="/wishlist"
              onClick={onClose}
              className="flex items-center justify-between px-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              <span className="flex items-center gap-2.5">
                <Heart size={16} className="text-gray-600" />
                {t("nav.wishlist", "Wishlist")}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                {wishCount}
              </span>
            </Link>
            <Link
              to="/cart"
              onClick={onClose}
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
              onClick={onClose}
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
              onClick={onClose}
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
              onClick={onClose}
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
              onClick={onClose}
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

        <div className="p-3.5 border-t border-gray-200 bg-gray-50 shrink-0 safe-area-bottom">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
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
                onClick={onSignOut}
                className="inline-flex items-center gap-1 px-3 min-h-[38px] rounded-lg border border-gray-300 bg-white text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
              >
                <LogOut size={14} />
                <span>{t("nav.signOut", "Sign Out")}</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
            >
              <UserIcon size={15} />
              <span>{t("nav.signIn", "Sign In / Register")}</span>
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
