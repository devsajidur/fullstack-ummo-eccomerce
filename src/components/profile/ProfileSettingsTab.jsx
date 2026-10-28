import React from "react";
import { KeyRound, Save } from "lucide-react";

export default function ProfileSettingsTab({
  profileForm,
  setProfileForm,
  onSaveProfile,
  onSendPasswordReset,
  userEmail,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Personal Profile Details
        </h3>
        <form onSubmit={onSaveProfile} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={profileForm.username}
              onChange={(e) =>
                setProfileForm({ ...profileForm, username: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={profileForm.phone}
              onChange={(e) =>
                setProfileForm({ ...profileForm, phone: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Short Bio / Delivery Preferences
            </label>
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) =>
                setProfileForm({ ...profileForm, bio: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 bg-gray-900 text-white font-semibold uppercase tracking-wider px-5 py-2.5 rounded cursor-pointer hover:bg-gray-800"
          >
            <Save size={14} /> Update Profile
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-2">
            Account Security & Password
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            Your account is registered with <strong>{userEmail}</strong>. For enterprise security, we never store plaintext passwords—click below to receive a verified password reset link.
          </p>
        </div>
        <button
          type="button"
          onClick={onSendPasswordReset}
          className="inline-flex items-center justify-center gap-2 border border-gray-900 text-gray-900 text-xs font-semibold uppercase tracking-wider px-5 py-3 rounded-lg hover:bg-gray-50 cursor-pointer"
        >
          <KeyRound size={15} /> Send Password Reset Email
        </button>
      </div>
    </div>
  );
}
