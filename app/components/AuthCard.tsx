"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  ArrowRight,
  Loader2,
} from "lucide-react";

type AuthTab = "signup" | "login";

export default function AuthCard() {
  const [activeTab, setActiveTab] = useState<AuthTab>("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Form state
  const [signUpForm, setSignUpForm] = useState({
    fullName: "",
    email: "",
    password: "",
    consent: false,
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate loading
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <motion.div
      className="w-full bg-white rounded-2xl border border-border shadow-lg shadow-black/[0.04] overflow-hidden"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      id="auth-card"
    >
      {/* Top bar */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-start justify-between mb-1 gap-2">
          <div>
            <h2 className="text-xl sm:text-[1.35rem] font-bold text-primary tracking-tight">
              Welcome to HemoLens
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Quick photo screening & personal health tracking
            </p>
          </div>
          {/* Language selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-heading hover:bg-surface transition-colors"
              id="language-selector"
              type="button"
            >
              <Globe className="w-3.5 h-3.5 text-muted" />
              <span>English</span>
              <ChevronDown
                className={`w-3 h-3 text-muted transition-transform ${langOpen ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 mt-1 w-32 bg-white border border-border rounded-lg shadow-lg py-1 z-10"
                >
                  {["English", "Hindi", "Spanish", "French"].map((lang) => (
                    <button
                      key={lang}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface transition-colors"
                      onClick={() => setLangOpen(false)}
                      type="button"
                    >
                      {lang}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6">
        <div className="relative flex border-b border-border">
          {(["signup", "login"] as AuthTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setShowPassword(false);
              }}
              className={`relative flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab ? "text-primary" : "text-muted hover:text-heading"
              }`}
              id={`tab-${tab}`}
              type="button"
            >
              {tab === "signup" ? "Sign Up" : "Log In"}
              {activeTab === tab && (
                <motion.div
                  layoutId="auth-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Form content */}
      <AnimatePresence mode="wait">
        {activeTab === "signup" ? (
          <motion.form
            key="signup"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.25 }}
            className="px-6 py-4 space-y-3"
            onSubmit={handleSubmit}
            id="signup-form"
          >
            {/* Full name */}
            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-semibold text-heading mb-1"
              >
                Full name <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="signup-name"
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={signUpForm.fullName}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, fullName: e.target.value })
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-semibold text-heading mb-1"
              >
                Email address <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={signUpForm.email}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, email: e.target.value })
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-semibold text-heading mb-1"
              >
                Password <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Create a password"
                  value={signUpForm.password}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, password: e.target.value })
                  }
                  className="w-full pl-9 pr-10 py-2 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full border border-muted" />
                Must be at least 8 characters with numbers or symbols
              </p>
            </div>

            {/* Consent */}
            <div className="rounded-lg border border-border bg-surface/60 p-2.5">
              <label
                htmlFor="consent-checkbox"
                className="flex items-start gap-2.5 cursor-pointer"
              >
                <input
                  id="consent-checkbox"
                  type="checkbox"
                  required
                  checked={signUpForm.consent}
                  onChange={(e) =>
                    setSignUpForm({
                      ...signUpForm,
                      consent: e.target.checked,
                    })
                  }
                  className="mt-0.5 w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30 accent-primary shrink-0"
                />
                <span className="text-[11px] leading-relaxed text-muted">
                  <span className="font-semibold text-heading">
                    Clinical Consent:
                  </span>{" "}
                  I understand that HemoLens provides preliminary screening
                  information and does not diagnose anemia or replace laboratory
                  testing or professional medical advice.
                </span>
              </label>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-xs"
              id="signup-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>

            {/* Footer link */}
            <p className="text-center text-xs text-muted pt-0.5">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="text-primary font-semibold hover:underline"
              >
                Log in
              </button>
            </p>
          </motion.form>
        ) : (
          <motion.form
            key="login"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            className="px-6 py-4 space-y-3"
            onSubmit={handleSubmit}
            id="login-form"
          >
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-heading mb-1"
              >
                Email address <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, email: e.target.value })
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-heading mb-1"
              >
                Password <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  className="w-full pl-9 pr-10 py-2 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs text-primary font-medium hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-xs"
              id="login-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>

            {/* Footer link */}
            <p className="text-center text-xs text-muted pt-0.5">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setActiveTab("signup")}
                className="text-primary font-semibold hover:underline"
              >
                Sign up
              </button>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
