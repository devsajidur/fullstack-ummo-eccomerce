import React, { useEffect, useState } from "react";
import Container from "../components/layout/common/Container";
import { FcGoogle } from "react-icons/fc";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router";
import {
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import {
  auth,
  browserPopupRedirectResolver,
  googleProvider,
  isSameOriginAuthDomain,
  warmGoogleAuthPopup,
} from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import { setSessionUser } from "../services/authSession";

function buildCustomerSessionPayload(user) {
  const fallbackName =
    user?.displayName || user?.email?.split("@")[0] || "Customer";
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: fallbackName,
    username: fallbackName,
    photoURL: user.photoURL || "",
    role: "CUSTOMER",
  };
}

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loader, setLoader] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAuthNotice, setGoogleAuthNotice] = useState("");

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
        setSessionUser(buildCustomerSessionPayload(result.user));
        toast.success("Signed in with Google!");
        navigate("/profile");
      })
      .catch((err) => {
        if (!active) return;
        const code = err?.code || "";
        if (code && code !== "auth/popup-closed-by-user") {
          toast.error("Google sign-in could not be completed. Please try again.");
        }
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setEmailError("");
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setPasswordError("");
  };

  const handleLoginSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    let hasError = false;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError("Enter a valid email address");
      hasError = true;
    }
    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    }

    if (hasError) return;

    setLoader(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      setSessionUser(buildCustomerSessionPayload(userCredential.user));
      toast.success("Sign in successful!");
      setLoader(false);
      setTimeout(() => {
        navigate("/profile");
      }, 350);
    } catch (error) {
      setLoader(false);
      const code = error?.code || "";
      const errorMessage = error?.message || "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        errorMessage.includes("auth/invalid-credential") ||
        errorMessage.includes("auth/wrong-password") ||
        errorMessage.includes("auth/user-not-found")
      ) {
        setPasswordError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setPasswordError(
          "Too many failed attempts. Please wait a moment or reset your password."
        );
      } else if (code === "auth/user-disabled") {
        setEmailError("This customer account has been disabled.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your internet connection.");
      } else {
        toast.error("Unable to sign in. Please verify your credentials.");
      }
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading || loader) return;
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
      setSessionUser(buildCustomerSessionPayload(result.user));
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
        toast.error("Please allow popups for this site to sign in with Google.");
      } else if (code === "auth/web-storage-unsupported") {
        const msg =
          "Strict browser tracking/shield settings blocked Google Sign-In storage. Please temporarily disable browser Shields for this site, or sign in with your Email and Password above.";
        setGoogleAuthNotice(msg);
        toast.error("Browser privacy settings blocked Google Sign-In storage.");
      } else if (code === "auth/account-exists-with-different-credential") {
        const msg =
          "An account already exists with this email address. Please sign in using your Email and Password above.";
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
      <Toaster />
      <Container>
        <div className="max-w-125 w-full mx-auto bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="text-center mb-7">
            <h1 className="text-xl sm:text-2xl text-primary font-bold uppercase tracking-wider">
              Customer Sign In
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5">
              Sign in to view your orders, track deliveries, and manage your saved addresses.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
            <div className="relative">
              <label
                htmlFor="customer-login-email"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Email Address *
              </label>
              <input
                id="customer-login-email"
                name="email"
                onChange={handleEmailChange}
                value={email}
                autoComplete="email"
                className={`w-full py-3 px-4 border ${
                  emailError ? "border-red-500" : "border-gray-300"
                } rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors`}
                type="email"
                placeholder="name@example.com"
              />
              {emailError && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {emailError}
                </p>
              )}
            </div>

            <div className="relative">
              <label
                htmlFor="customer-login-password"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Password *
              </label>
              <div className="relative">
                <input
                  id="customer-login-password"
                  name="password"
                  onChange={handlePasswordChange}
                  value={password}
                  autoComplete="current-password"
                  className={`w-full py-3 pl-4 pr-11 border ${
                    passwordError ? "border-red-500" : "border-gray-300"
                  } rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors`}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-900 cursor-pointer"
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

            <div className="flex flex-wrap gap-3 justify-between items-center text-xs">
              <label className="flex gap-2 items-center text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary w-4 h-4 rounded"
                />
                <span>Remember me</span>
              </label>
              <Link
                to="/forgot"
                className="text-primary font-semibold underline hover:text-gray-700"
              >
                Forgot password?
              </Link>
            </div>

            {loader ? (
              <div
                aria-label="Signing in"
                className="w-full min-h-[48px] rounded-lg bg-primary text-white flex justify-center items-center gap-2 text-xs font-bold uppercase tracking-wider"
              >
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Signing In...</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={googleLoading}
                className="w-full min-h-[48px] rounded-lg bg-primary hover:bg-gray-800 text-white cursor-pointer text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              disabled={googleLoading || loader}
              onClick={handleGoogleLogin}
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
                No account yet?{" "}
                <Link
                  to="/register"
                  className="text-primary font-bold underline ml-1"
                >
                  Create Account
                </Link>
              </p>
            </div>
          </form>
        </div>
      </Container>
    </div>
  );
};

export default LoginPage;
