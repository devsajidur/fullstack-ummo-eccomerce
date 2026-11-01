import React from "react";
import { Toaster } from "react-hot-toast";
import {
  Archive,
  CreditCard,
  ExternalLink,
  Flame,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";

export const ADMIN_MODULES = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "products", label: "Products", icon: Package },
  { id: "featured", label: "Featured Collection", icon: Sparkles },
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "inventory", label: "Inventory", icon: Archive },
  { id: "discounts", label: "Discounts", icon: Flame },
  { id: "coupons", label: "Coupons", icon: Tag },
  { id: "customers", label: "Customers", icon: Users },
  {
    id: "payments",
    label: "Payments & Refunds",
    icon: CreditCard,
  },
  { id: "banners", label: "Banners & CMS", icon: ImageIcon },
  { id: "security", label: "Account Security", icon: ShieldCheck },
];

export default function AdminNavigationShell({
  authUser,
  activeTab,
  metrics,
  mobileDrawerOpen,
  setMobileDrawerOpen,
  onSelectModule,
  onNavigateStorefront,
  onSignOut,
  children,
}) {
  const activeModuleObj =
    ADMIN_MODULES.find((m) => m.id === activeTab) || ADMIN_MODULES[0];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-right" />

      <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Open admin navigation drawer"
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-gray-900">
                UOMO
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                <ShieldCheck size={11} /> Admin
              </span>
            </div>
            <p className="text-[11px] text-gray-500 truncate">
              {activeModuleObj.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateStorefront}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer"
          >
            <span className="hidden sm:inline">Storefront</span>
            <ExternalLink size={13} />
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="hidden sm:inline-flex items-center gap-1.5 border border-red-200 text-red-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-red-50 cursor-pointer"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            aria-hidden="true"
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          />
          <aside
            aria-label="Mobile Admin Navigation"
            className="relative z-10 w-[84vw] max-w-[300px] h-[100dvh] bg-white shadow-2xl flex flex-col justify-between overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  UOMO Admin Portal
                </p>
                <p className="text-[11px] text-gray-500 truncate max-w-[200px]">
                  {authUser.email}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close admin navigation drawer"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              {ADMIN_MODULES.map((mod) => {
                const Icon = mod.icon;
                const active = activeTab === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => onSelectModule(mod.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? "bg-gray-900 text-white shadow-xs"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={16} />
                      {mod.label}
                    </span>
                    {mod.id === "orders" && metrics.pendingOrders > 0 && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          active
                            ? "bg-white text-gray-900"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {metrics.pendingOrders}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-gray-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onNavigateStorefront();
                }}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                <ExternalLink size={14} />
                View Storefront
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold py-2.5 rounded-xl hover:bg-red-100 cursor-pointer"
              >
                <LogOut size={14} />
                Sign Out Admin
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex container mx-auto max-w-7xl w-full px-3 sm:px-6 py-4 sm:py-6 gap-6">
        <aside className="hidden lg:flex flex-col w-60 shrink-0">
          <div className="bg-white border border-gray-200 rounded-2xl p-3 sticky top-22 space-y-1 shadow-xs">
            <div className="px-3 py-2 border-b border-gray-100 mb-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Admin Modules
              </p>
              <p className="text-xs font-semibold text-gray-800 truncate mt-0.5">
                {authUser.email}
              </p>
            </div>

            {ADMIN_MODULES.map((mod) => {
              const Icon = mod.icon;
              const active = activeTab === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => onSelectModule(mod.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-gray-900 text-white shadow-xs"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={15} />
                    {mod.label}
                  </span>
                  {mod.id === "orders" && metrics.pendingOrders > 0 && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        active
                          ? "bg-white text-gray-900"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {metrics.pendingOrders}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-3">
            {ADMIN_MODULES.map((mod) => {
              const Icon = mod.icon;
              const active = activeTab === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => onSelectModule(mod.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer border ${
                    active
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  <Icon size={13} />
                  {mod.label}
                </button>
              );
            })}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
