import React, { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendEmailVerification,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from "firebase/auth";
import {
  auth,
  browserPopupRedirectResolver,
  googleProvider,
  isSameOriginAuthDomain,
  warmGoogleAuthPopup,
} from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import { FcGoogle } from "react-icons/fc";
import { Eye, EyeOff } from "lucide-react";
import Container from "../components/layout/common/Container";
import { setSessionUser } from "../services/authSession";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg";

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAuthNotice, setGoogleAuthNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();

  // Pre-warm Firebase popup resolver so window.open executes synchronously on click.
  // Only check getRedirectResult when authDomain is same-origin (avoids cross-origin
  // storage-partitioned redirect state errors on modern browsers).
  useEffect(() => {
    let active = true;
    warmGoogleAuthPopup();
    if (!isSameOriginAuthDomain()) {
      return () => {
        active = false;
      };
    }
    getRedirectResult(auth, browserPopupRedirectResolver)
      .then((result) => {
        if (!active || !result?.user) return;
        const u = result.user;
        const display = u.displayName || u.email?.split("@")[0] || "Customer";
        setSessionUser({
          uid: u.uid,
          email: u.email || "",
          displayName: display,
          username: display,
          photoURL: u.photoURL || DEFAULT_AVATAR,
          role: "CUSTOMER",
        });
        toast.success("Signed up with Google!");
        navigate("/profile");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setNameError("");
    setEmailError("");
    setPasswordError("");

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    let hasError = false;

    if (trimmedName.length < 2) {
      setNameError("Please enter your full name (at least 2 characters).");
      hasError = true;
    }
    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setEmailError("Please enter a valid email address.");
      hasError = true;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: trimmedName,
        photoURL: DEFAULT_AVATAR,
      }).catch(() => {});

      // Send verification email asynchronously so sign-up completion is instant
      sendEmailVerification(user).catch(() => {});

      setSessionUser({
        uid: user.uid,
        email: normalizedEmail,
        displayName: trimmedName,
        username: trimmedName,
        photoURL: DEFAULT_AVATAR,
        role: "CUSTOMER",
        emailVerified: user.emailVerified,
      });

      setName("");
      setEmail("");
      setPassword("");
      toast.success("Account created! Welcome to UOMO.");
      setTimeout(() => navigate("/profile"), 350);
    } catch (error) {
      const code = error?.code || "";
      if (code === "auth/email-already-in-use") {
        setEmailError(
          "An account with this email already exists. Please sign in instead."
        );
        toast.error("This email is already registered.");
      } else if (code === "auth/invalid-email") {
        setEmailError("Please enter a valid email address.");
      } else if (code === "auth/weak-password") {
        setPasswordError(
          "Password is too weak. Please use at least 8 characters."
        );
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your internet connection.");
      } else {
        toast.error("Could not create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (googleLoading || loading) return;
    setGoogleAuthNotice("");
    // Invoke signInWithPopup synchronously inside the user-gesture turn before state re-renders
    const popupPromise = signInWithPopup(
      auth,
      googleProvider,
      browserPopupRedirectResolver
    );
    setGoogleLoading(true);
    try {
      const result = await popupPromise;
      const u = result.user;
      const display = u.displayName || u.email?.split("@")[0] || "Customer";
      setSessionUser({
        uid: u.uid,
        email: u.email || "",
        displayName: display,
        username: display,
        photoURL: u.photoURL || DEFAULT_AVATAR,
        role: "CUSTOMER",
      });
      toast.success("Signed in with Google!");
      navigate("/profile");
    } catch (error) {
      const code = error?.code || "";
      if (code === "auth/popup-blocked") {
        if (isSameOriginAuthDomain()) {
          try {
            await signInWithRedirect(
              auth,
              googleProvider,
              browserPopupRedirectResolver
            );
            return;
          } catch {
            // Fall through to popup blocked guidance
          }
        }
        const msg =
          "Your browser blocked the Google Sign-In window. Please allow popups for this site in your browser address bar and tap 'Continue With Google' again.";
        setGoogleAuthNotice(msg);
        toast.error("Please allow popups for this site to continue with Google.");
      } else if (code === "auth/web-storage-unsupported") {
        const msg =
          "Strict browser tracking/shield settings blocked Google Sign-In storage. Please temporarily disable browser Shields for this site, or create an account with your Email and Password above.";
        setGoogleAuthNotice(msg);
        toast.error("Browser privacy settings blocked Google Sign-In storage.");
      } else if (code === "auth/account-exists-with-different-credential") {
        const msg =
          "An account already exists with this email address. Please sign in with your Email and Password.";
        setGoogleAuthNotice(msg);
        toast.error("Account exists with email/password sign-in.");
      } else if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        toast("Google sign-in window was closed.");
      } else if (code === "auth/unauthorized-domain") {
        const msg =
          "This preview domain is not authorized for Google Sign-In. Please open fullstack-ummo-eccomerce.vercel.app.";
        setGoogleAuthNotice(msg);
        toast.error(msg);
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error while connecting to Google Sign-In.");
      } else {
        toast.error("Google sign-in could not be completed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="py-10 md:py-16 px-4">
      <Toaster position="top-center" reverseOrder={false} />
      <Container>
        <div className="max-w-125 w-full mx-auto bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="text-center mb-7">
            <h1 className="text-xl sm:text-2xl text-primary font-bold uppercase tracking-wider">
              Create Customer Account
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5">
              Register to track your orders, save delivery addresses, and checkout faster.
            </p>
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-5">
            {/* Name */}
            <div className="relative">
              <label
                htmlFor="customer-register-name"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Full Name *
              </label>
              <input
                id="customer-register-name"
                name="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError("");
                }}
                type="text"
                autoComplete="name"
                placeholder="Enter your name *"
                required
                className={`w-full py-3 px-4 border ${
                  nameError ? "border-red-500" : "border-gray-300"
                } rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors`}
              />
              {nameError && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {nameError}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="relative">
              <label
                htmlFor="customer-register-email"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Email Address *
              </label>
              <input
                id="customer-register-email"
                name="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                type="email"
                autoComplete="email"
                placeholder="Enter your email address *"
                required
                className={`w-full py-3 px-4 border ${
                  emailError ? "border-red-500" : "border-gray-300"
                } rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors`}
              />
              {emailError && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="relative">
              <label
                htmlFor="customer-register-password"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Password * (Min 8 characters)
              </label>
              <div className="relative">
                <input
                  id="customer-register-password"
                  name="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="••••••••"
                  required
                  className={`w-full py-3 pl-4 pr-11 border ${
                    passwordError ? "border-red-500" : "border-gray-300"
                  } rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-900 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {passwordError}
                </p>
              )}
            </div>

            <p className="text-xs leading-5 text-gray-500">
              Your personal data will be used to support your shopping experience,
              manage access to your account, and fulfill orders securely.
            </p>

            {loading ? (
              <div
                aria-label="Creating account"
                className="w-full min-h-[48px] rounded-lg bg-primary text-white flex justify-center items-center gap-2 text-xs font-bold uppercase tracking-wider"
              >
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Creating Account...</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={googleLoading}
                className="w-full min-h-[48px] rounded-lg bg-primary hover:bg-gray-800 text-white cursor-pointer text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
              >
                Create Account
              </button>
            )}

            <button
              type="button"
              disabled={googleLoading || loading}
              onClick={handleGoogleSignUp}
              className="w-full min-h-[48px] rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-xs uppercase tracking-wider flex items-center gap-2.5 justify-center cursor-pointer transition-colors disabled:opacity-60"
            >
              {googleLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-gray-800 border-t-transparent animate-spin" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <FcGoogle className="text-xl" />
                  <span>Continue With Google</span>
                </>
              )}
            </button>

            {googleAuthNotice && (
              <div
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-900"
              >
                {googleAuthNotice}
              </div>
            )}

            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-xs sm:text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-primary font-bold underline ml-1"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </form>
        </div>
      </Container>
    </div>
  );
}
