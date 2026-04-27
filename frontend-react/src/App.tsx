import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import LoadingScreen from "./components/LoadingScreen";
import HeroPage from "./components/HeroPage";
import CheckerPage from "./components/CheckerPage";
import HowItWorks from "./components/HowItWorks";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// ── Protected route wrapper ───────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <span className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

// ── Inner app (needs AuthProvider to be available) ───────────────────────────
function InnerApp() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
      </AnimatePresence>
      <div style={{ opacity: isLoading ? 0 : 1, transition: "opacity 0.5s ease-out" }}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HeroPage />} />
          <Route path="/check" element={<CheckerPage />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Protected routes — require login */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </BrowserRouter>
  );
}
