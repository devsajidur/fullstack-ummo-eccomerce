import React, { useState } from "react";
import Container from "../components/layout/common/Container";
import { FcGoogle } from "react-icons/fc";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import { setSessionUser } from "../services/authSession";

const LoginPage = () => {
  const provider = new GoogleAuthProvider();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loader, setLoader] = useState(false);

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
    if (!email.trim()) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
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
        email.trim(),
        password
      );
      const user = userCredential.user;
      setSessionUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "Customer",
        username: user.displayName || user.email?.split("@")[0] || "Customer",
        photoURL: user.photoURL,
        role: "CUSTOMER",
      });
      toast.success("Sign in successful!");
      setLoader(false);
      setTimeout(() => {
        navigate("/profile");
      }, 400);
    } catch (error) {
      setLoader(false);
      const errorMessage = error?.message || "";
      if (
        errorMessage.includes("auth/invalid-credential") ||
        errorMessage.includes("auth/wrong-password") ||
        errorMessage.includes("auth/user-not-found")
      ) {
        setPasswordError("Invalid email or password.");
      } else {
        toast.error("Unable to sign in. Please verify your credentials.");
      }
    }
  };

  const handleGoogleLogin = () => {
    signInWithPopup(auth, provider)
      .then((result) => {
        const user = result.user;
        setSessionUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          username: user.displayName,
          photoURL: user.photoURL,
          role: "CUSTOMER",
        });
        toast.success("Signed in with Google!");
        navigate("/profile");
      })
      .catch(() => {
        toast.error("Google sign-in could not be completed.");
      });
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
                className="w-full min-h-[48px] rounded-lg bg-primary hover:bg-gray-800 text-white cursor-pointer text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full min-h-[48px] rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-xs uppercase tracking-wider flex items-center gap-2.5 justify-center cursor-pointer transition-colors"
            >
              <FcGoogle className="text-xl" />
              Continue With Google
            </button>

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
