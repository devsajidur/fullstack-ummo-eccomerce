import React, { useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { changeAdminPasswordWithServer } from "../../services/api";
import { saveAdminSessionToken } from "../../services/authSession";

export default function AdminSecurityTab({
  authUser,
  securityStatus,
  onSecurityUpdated,
  onSignOut,
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isDemo = Boolean(authUser?.isDemo);

  const checks = [
    {
      label: "At least 12 characters",
      met: newPassword.length >= 12,
    },
    {
      label: "Uppercase & lowercase letters",
      met: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword),
    },
    {
      label: "At least one number",
      met: /[0-9]/.test(newPassword),
    },
    {
      label: "At least one symbol",
      met: /[^A-Za-z0-9]/.test(newPassword),
    },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (isDemo) {
      toast.error("Demo accounts cannot change the owner password.");
      return;
    }
    if (!currentPassword || !newPassword) {
      toast.error("Enter both your current password and new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (!checks.every((c) => c.met)) {
      toast.error("New password does not meet complexity requirements.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await changeAdminPasswordWithServer(
        currentPassword,
        newPassword
      );
      if (res?.adminToken) {
        saveAdminSessionToken(res.adminToken);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(
        "Owner password rotated and all older sessions invalidated."
      );
      if (typeof onSecurityUpdated === "function") {
        onSecurityUpdated(res);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update administrator password.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const postureItems = [
    {
      label: "Password KDF Storage",
      ok: Boolean(securityStatus?.passwordConfiguredInDb),
      detail: securityStatus?.passwordConfiguredInDb
        ? "Salted scrypt (MongoDB Atlas)"
        : "Environment hash / recovery required",
    },
    {
      label: "Session Token HMAC Secret",
      ok: securityStatus?.authSecretConfigured !== false,
      detail:
        securityStatus?.authSecretConfigured !== false
          ? "AUTH_SECRET configured (12h TTL)"
          : "Missing AUTH_SECRET",
    },
    {
      label: "MongoDB Security Guard",
      ok: Boolean(securityStatus?.mongoConnected),
      detail: securityStatus?.mongoConnected
        ? "Connected & durable across instances"
        : "Fallback memory mode",
    },
    {
      label: "Cloudinary Signed Media",
      ok: Boolean(securityStatus?.cloudinarySigningConfigured),
      detail: securityStatus?.cloudinarySigningConfigured
        ? "Server-side SHA-1 signing active"
        : "Missing Cloudinary API credentials",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Administrator Account &amp; Security Posture
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage owner credentials, salted scrypt password hashing, and
                active session invalidation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 border border-red-200 bg-red-50 text-red-700 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-red-100 cursor-pointer"
          >
            <LogOut size={14} />
            Revoke Current Session
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Authenticated Email
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1 break-all">
              {authUser?.email || "admin@ummo.com"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Privilege Tier
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {isDemo ? "Restricted Demo Admin" : "Owner Administrator (ADMIN)"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Last Password Rotation
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
              {securityStatus?.passwordUpdatedAt
                ? new Date(securityStatus.passwordUpdatedAt).toLocaleString()
                : "Not rotated via DB yet"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {postureItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 p-3.5 flex items-start gap-2.5"
            >
              {item.ok ? (
                <CheckCircle2
                  size={16}
                  className="text-emerald-600 shrink-0 mt-0.5"
                />
              ) : (
                <ShieldAlert
                  size={16}
                  className="text-amber-600 shrink-0 mt-0.5"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900">
                  {item.label}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs max-w-2xl">
        <div className="flex items-center gap-2.5 mb-1">
          <KeyRound size={18} className="text-gray-900" />
          <h3 className="text-sm sm:text-base font-bold text-gray-900">
            Change Owner Password &amp; Invalidate Other Sessions
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Updating your password derives a new salted scrypt key in MongoDB
          Atlas and immediately revokes all administrator tokens issued prior to
          this rotation.
        </p>

        {isDemo ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            Password rotation is disabled for restricted demo accounts.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="sec-current-password"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  id="sec-current-password"
                  type={showPasswords ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
                />
                <button
                  type="button"
                  aria-label={
                    showPasswords ? "Hide passwords" : "Show passwords"
                  }
                  onClick={() => setShowPasswords((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sec-new-password"
                  className="block text-xs font-semibold text-gray-700 mb-1.5"
                >
                  New Owner Password
                </label>
                <input
                  id="sec-new-password"
                  type={showPasswords ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor="sec-confirm-password"
                  className="block text-xs font-semibold text-gray-700 mb-1.5"
                >
                  Confirm New Password
                </label>
                <input
                  id="sec-confirm-password"
                  type={showPasswords ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-gray-50 border border-gray-100 p-3">
              {checks.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 text-xs ${
                    item.met ? "text-emerald-700 font-medium" : "text-gray-500"
                  }`}
                >
                  <CheckCircle2
                    size={14}
                    className={
                      item.met ? "text-emerald-600" : "text-gray-300"
                    }
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider px-5 py-3 rounded-xl hover:bg-gray-800 disabled:opacity-60 cursor-pointer transition-colors"
            >
              {submitting
                ? "Rotating Password..."
                : "Update Password & Invalidate Sessions"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
