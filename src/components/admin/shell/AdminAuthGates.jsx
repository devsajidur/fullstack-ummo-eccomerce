import React, { useEffect, useState } from "react";
import { apiClient } from "../../../services/api";
import { Toaster } from "react-hot-toast";
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";

export function AdminForbiddenGate({ authUser, onReturnStore, onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <Toaster position="top-right" />
      <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={22} />
        </div>
        <span className="inline-block text-[11px] font-bold uppercase tracking-widest bg-red-100 text-red-800 px-3 py-0.5 rounded-full mb-2">
          HTTP 403 • Access Denied
        </span>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">
          Administrator Privileges Required
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-2">
          You are currently signed in as{" "}
          <strong className="text-gray-900">{authUser.email}</strong> (Role:{" "}
          <span className="font-mono font-semibold">
            {authUser.role || "CUSTOMER"}
          </span>
          ). This account does not have permission to access the UOMO
          Administration Portal.
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={onReturnStore}
            className="w-full bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider py-3 rounded-xl hover:bg-gray-800 cursor-pointer transition-colors"
          >
            Return to Storefront
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full border border-gray-300 text-gray-700 text-xs font-semibold uppercase tracking-wider py-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
          >
            Sign Out &amp; Switch to Admin Account
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLoginPortal({
  adminEmail,
  setAdminEmail,
  adminPass,
  setAdminPass,
  showPassword,
  setShowPassword,
  loginSubmitting,
  loginError,
  onSubmit,
  onDemoLogin,
  onReturnStore,
}) {
  const [demoConfig, setDemoConfig] = useState(null);
  useEffect(() => {
    let active = true;
    apiClient.get("/admin/demo-config").then(({ data }) => { if (active) setDemoConfig(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-950">
      <Toaster position="top-right" />
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-black tracking-tight text-gray-900">
            UOMO{" "}
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Admin
            </span>
          </span>
        </div>

        <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center mb-4">
          <Lock size={20} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          Administrator Sign In
        </h1>
        <p className="text-xs text-gray-500 mt-1 mb-6">
          Restricted portal. Enter your authorized administrator credentials to
          continue.
        </p>

        {loginError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
          >
            {loginError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-left">
          <div>
            <label
              htmlFor="admin-login-email"
              className="block text-xs font-semibold text-gray-700 mb-1.5"
            >
              Administrator Email
            </label>
            <input
              id="admin-login-email"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@domain.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label
              htmlFor="admin-login-password"
              className="block text-xs font-semibold text-gray-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                className="w-full border border-gray-300 rounded-xl pl-3.5 pr-10 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginSubmitting}
            className="w-full bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider py-3.5 rounded-xl hover:bg-gray-800 disabled:opacity-60 cursor-pointer transition-colors"
          >
            {loginSubmitting
              ? "Verifying Credentials..."
              : "Sign In to Admin Portal"}
          </button>
        </form>

        {demoConfig?.enabled && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm" data-testid="demo-admin-hint">
            <button type="button" disabled={loginSubmitting} onClick={onDemoLogin}
              className="w-full rounded-xl bg-amber-900 text-white p-3 font-semibold disabled:opacity-60">
              Explore Demo Admin
            </button>
            <p className="mt-3 font-semibold">Demo Mode — Read Only</p>
            <p className="mt-2 break-all">Email: {demoConfig.email}</p>
            {demoConfig.password && <p className="break-all">Password: {demoConfig.password}</p>}
            <p className="mt-2 text-xs">Explore live business data with customer details protected. Changes are disabled.</p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={onReturnStore}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            ← Return to Storefront
          </button>
        </div>
      </div>
    </div>
  );
}
