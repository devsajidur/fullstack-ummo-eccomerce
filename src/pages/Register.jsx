import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../../firebase.config";
import toast, { Toaster } from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import { setSessionUser } from "../services/authSession";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg";

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.5 6.6C3.9 8.2 2 12 2 12s4 7 10 7c1.9 0 3.6-.6 5-1.6M17.4 17.4C19.6 15.8 22 12 22 12s-4-7-10-7c-.7 0-1.4.1-2.1.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: trimmedName,
        photoURL: DEFAULT_AVATAR,
      });

      await sendEmailVerification(user).catch(() => {});

      setSessionUser({
        uid: user.uid,
        email: normalizedEmail,
        displayName: trimmedName,
        photoURL: DEFAULT_AVATAR,
        role: "CUSTOMER",
        emailVerified: user.emailVerified,
      });

      setName("");
      setEmail("");
      setPassword("");
      toast.success("Account created! Welcome to UOMO.");
      setTimeout(() => navigate("/"), 1200);
    } catch (error) {
      toast.error(error?.message || "Failed to register account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex justify-center bg-white px-4 py-12 font-jost">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="w-full max-w-md">
        {/* Tabs */}
        <div className="flex items-center justify-center gap-8 sm:gap-10 mb-8 sm:mb-10">
          <button
            type="button"
            className="relative font-medium text-primary text-sm sm:text-base"
          >
            REGISTER
            <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary" />
          </button>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-6">
          {/* Name */}
          <div className="border-2 border-[#e4e4e4]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="Enter your name *"
              required
              className="w-full border-none px-4.25 h-13.75 text-sm text-primary placeholder:text-gray focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Email */}
          <div className="border-2 border-[#e4e4e4]">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Enter your email address *"
              required
              className="w-full border-none px-4.25 h-13.75 text-sm text-primary placeholder:text-gray focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Password with notched label */}
          <div className="relative pt-2.5">
            <span className="absolute top-0 left-3 bg-white z-10 px-1.5 text-xs text-primary">
              Password * (Min 8 chars)
            </span>
            <div className="relative border-2 border-primary">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                minLength={8}
                required
                className={`w-full px-4.25 h-13.75 ${
                  !showPassword ? "text-[20px]" : "text-sm"
                } pr-12 text-primary focus:outline-none border-2`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-primary transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <p className="text-sm font-normal leading-6 text-gray">
            Your personal data will be used to support your experience
            throughout this website, to manage access to your account, and for
            other purposes described in our privacy policy.
          </p>
          {loading ? (
            <button
              type="button"
              className="w-full bg-primary/70 text-white text-sm justify-center flex py-4 cursor-not-allowed"
              disabled
            >
              Processing…
            </button>
          ) : (
            <button
              type="submit"
              className="w-full bg-primary text-white text-sm tracking-wide py-4 hover:opacity-90 transition-opacity cursor-pointer"
            >
              REGISTER
            </button>
          )}

          {/* Footer link */}
          <p className="text-center text-sm text-gray">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary underline underline-offset-2 hover:text-gray transition-colors"
            >
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
