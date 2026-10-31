import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { LuArrowLeft } from "react-icons/lu";
import { Link, useNavigate } from "react-router";
import { CiMail } from "react-icons/ci";
import { auth } from "../../firebase.config";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e?.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail.toLowerCase());
      setEmail("");
      toast.success("Password reset link sent! Please check your inbox.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (error) {
      const code = error?.code || "";
      if (code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many reset requests. Please try again shortly.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your internet connection.");
      } else {
        toast.error("Could not send password reset email. Please verify the address.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            Forgot your password?
          </h1>
          <p className="text-sm text-gray-600">
            Enter the email associated with your account and we'll send you a
            link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Email address
            </label>
            <div className="relative">
              <CiMail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-[#222222bd] active:bg-primary cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <Link
          to="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <LuArrowLeft size={16} />
          Back to login
        </Link>
      </div>
    </div>
  );
}
