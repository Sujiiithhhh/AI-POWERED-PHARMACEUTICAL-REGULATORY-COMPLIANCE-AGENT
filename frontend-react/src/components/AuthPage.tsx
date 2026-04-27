/**
 * AuthPage — Login / Register / TOTP 2FA
 * ========================================
 * Dark theme matching HeroPage aesthetic.
 * Handles three views: login, register, totp_verify
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

type AuthView = "login" | "register" | "totp_verify";

export default function AuthPage() {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/dashboard";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "TOTP_REQUIRED") {
        setPendingCredentials({ email, password });
        setView("totp_verify");
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTotpVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingCredentials) return;
    setError("");
    setIsSubmitting(true);
    try {
      await login(pendingCredentials.email, pendingCredentials.password, totpCode);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await register(email, password, fullName, tenantName);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #080808 0%, #0d1a0d 100%)" }}
    >
      {/* Glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 600px 400px at 50% 30%, rgba(34,197,94,0.06) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <span
            className="text-2xl font-bold tracking-tight"
            style={{
              fontFamily: "Barlow, sans-serif",
              color: "#22c55e",
              letterSpacing: "0.05em",
            }}
          >
            PHARMACHECK
          </span>
          <p className="text-white/40 text-sm mt-1">AI-powered compliance platform</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-white/10 p-8"
          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)" }}
        >
          <AnimatePresence mode="wait">

            {/* ── Login ─────────────────────────────────────────────────── */}
            {view === "login" && (
              <motion.form
                key="login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleLogin}
                className="space-y-5"
              >
                <h2 className="text-xl font-semibold text-white mb-1">Sign in</h2>
                <p className="text-white/40 text-sm">Welcome back to PharmaCheck.</p>

                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@org.com" required />
                <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />

                {error && <ErrorMsg message={error} />}

                <SubmitButton isSubmitting={isSubmitting} label="Sign in" />

                <p className="text-center text-sm text-white/40">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => { setView("register"); setError(""); }}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors">
                    Register
                  </button>
                </p>
              </motion.form>
            )}

            {/* ── Register ──────────────────────────────────────────────── */}
            {view === "register" && (
              <motion.form
                key="register"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold text-white mb-1">Create account</h2>
                <p className="text-white/40 text-sm">Start your compliance journey.</p>

                <Field label="Full name" type="text" value={fullName} onChange={setFullName} placeholder="Jane Smith" />
                <Field label="Organisation" type="text" value={tenantName} onChange={setTenantName} placeholder="Acme Pharma Ltd" />
                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@org.com" required />
                <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" required />

                {error && <ErrorMsg message={error} />}

                <SubmitButton isSubmitting={isSubmitting} label="Create account" />

                <p className="text-center text-sm text-white/40">
                  Already have an account?{" "}
                  <button type="button" onClick={() => { setView("login"); setError(""); }}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors">
                    Sign in
                  </button>
                </p>
              </motion.form>
            )}

            {/* ── TOTP 2FA ──────────────────────────────────────────────── */}
            {view === "totp_verify" && (
              <motion.form
                key="totp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleTotpVerify}
                className="space-y-5"
              >
                <h2 className="text-xl font-semibold text-white">Two-Factor Auth</h2>
                <p className="text-white/40 text-sm">
                  Enter the 6-digit code from your authenticator app.
                </p>

                <TotpInput value={totpCode} onChange={setTotpCode} />

                {error && <ErrorMsg message={error} />}

                <SubmitButton isSubmitting={isSubmitting} label="Verify code" />

                <p className="text-center text-sm text-white/40">
                  <button type="button" onClick={() => { setView("login"); setError(""); setPendingCredentials(null); }}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors">
                    ← Back to login
                  </button>
                </p>
              </motion.form>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  label, type, value, onChange, placeholder, required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-white/60">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-colors"
      />
    </div>
  );
}

function TotpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="flex justify-center">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="w-48 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder-white/20 focus:border-emerald-500/50 focus:outline-none transition-colors"
      />
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400"
    >
      {message}
    </motion.div>
  );
}

function SubmitButton({ isSubmitting, label }: { isSubmitting: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="w-full rounded-xl py-3 text-sm font-semibold text-black transition-all disabled:opacity-50"
      style={{ background: isSubmitting ? "rgba(34,197,94,0.6)" : "#22c55e" }}
    >
      {isSubmitting ? "Please wait…" : label}
    </button>
  );
}
