import React, { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import toast from "react-hot-toast";

export default function ProfileSettingsTab({
  profileForm,
  setProfileForm,
  displayName = "",
  setDisplayName,
  phone = "",
  setPhone,
  photoURL = "",
  setPhotoURL,
  bio = "",
  setBio,
  savingProfile = false,
  onSaveProfile,
  onSendPasswordReset,
  userEmail = "",
}) {
  const [sendingReset, setSendingReset] = useState(false);

  const currentName = profileForm ? profileForm.username || "" : displayName;
  const currentPhone = profileForm ? profileForm.phone || "" : phone;
  const currentBio = profileForm ? profileForm.bio || "" : bio;
  const currentPhoto = profileForm ? profileForm.photoURL || "" : photoURL;

  const updateName = (val) => {
    if (setProfileForm && profileForm) {
      setProfileForm({ ...profileForm, username: val });
    } else if (setDisplayName) {
      setDisplayName(val);
    }
  };

  const updatePhone = (val) => {
    if (setProfileForm && profileForm) {
      setProfileForm({ ...profileForm, phone: val });
    } else if (setPhone) {
      setPhone(val);
    }
  };

  const updatePhoto = (val) => {
    if (setProfileForm && profileForm) {
      setProfileForm({ ...profileForm, photoURL: val });
    } else if (setPhotoURL) {
      setPhotoURL(val);
    }
  };

  const updateBio = (val) => {
    if (setProfileForm && profileForm) {
      setProfileForm({ ...profileForm, bio: val });
    } else if (setBio) {
      setBio(val);
    }
  };

  const handlePasswordReset = async () => {
    if (onSendPasswordReset) {
      onSendPasswordReset();
      return;
    }
    if (!userEmail) {
      toast.error("No email address associated with this account.");
      return;
    }
    setSendingReset(true);
    try {
      const { auth } = await import("../../../firebase.config");
      await sendPasswordResetEmail(auth, userEmail.trim().toLowerCase());
      toast.success(`Password reset link sent to ${userEmail}`);
    } catch {
      toast.error("Could not send password reset email. Please try again.");
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Personal Profile Details
        </h3>
        <form onSubmit={onSaveProfile} className="space-y-4 text-xs">
          <div>
            <label
              htmlFor="profile-display-name"
              className="block font-semibold text-gray-600 mb-1"
            >
              Display Name
            </label>
            <input
              id="profile-display-name"
              type="text"
              required
              value={currentName}
              onChange={(e) => updateName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <div>
            <label
              htmlFor="profile-phone"
              className="block font-semibold text-gray-600 mb-1"
            >
              Phone Number
            </label>
            <input
              id="profile-phone"
              type="tel"
              placeholder="+8801..."
              value={currentPhone}
              onChange={(e) => updatePhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900"
            />
          </div>
          {setPhotoURL && (
            <div>
              <label
                htmlFor="profile-photo-url"
                className="block font-semibold text-gray-600 mb-1"
              >
                Avatar Image URL (Optional)
              </label>
              <input
                id="profile-photo-url"
                type="url"
                placeholder="https://..."
                value={currentPhoto}
                onChange={(e) => updatePhoto(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900"
              />
            </div>
          )}
          <div>
            <label
              htmlFor="profile-bio"
              className="block font-semibold text-gray-600 mb-1"
            >
              Short Bio / Delivery Preferences
            </label>
            <textarea
              id="profile-bio"
              rows={3}
              value={currentBio}
              onChange={(e) => updateBio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-1.5 bg-gray-900 text-white font-semibold uppercase tracking-wider px-5 py-2.5 rounded-lg cursor-pointer hover:bg-gray-800 disabled:opacity-60"
          >
            <Save size={14} />
            {savingProfile ? "Saving..." : "Save Profile Settings"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-2">
            Account Security & Password
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            Your account is registered with <strong>{userEmail}</strong>. Click
            below to receive a verified password reset link directly in your
            email inbox.
          </p>
        </div>
        <button
          type="button"
          disabled={sendingReset}
          onClick={handlePasswordReset}
          className="inline-flex items-center justify-center gap-2 border border-gray-900 text-gray-900 text-xs font-semibold uppercase tracking-wider px-5 py-3 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-60"
        >
          <KeyRound size={15} />
          {sendingReset ? "Sending..." : "Send Password Reset Email"}
        </button>
      </div>
    </div>
  );
}
