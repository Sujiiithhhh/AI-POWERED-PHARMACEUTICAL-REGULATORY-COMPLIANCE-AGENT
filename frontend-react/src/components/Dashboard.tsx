/**
 * Dashboard — Tenant analytics and compliance history
 * =====================================================
 * Shows: compliance stats, recent checks history, violation trends,
 * ML risk scores, and regulatory alerts feed.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryItem {
  id: string;
  status: string;
  score: number;
  violation_count: number;
  created_at: string;
}

interface Alert {
  id: number;
  source: string;
  title: string;
  severity: string;
  summary: string;
  received_date: string;
}

interface Stats {
  total: number;
  passed: number;
  failed: number;
  needs_review: number;
  avg_score: number;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, passed: 0, failed: 0, needs_review: 0, avg_score: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }), [accessToken]);

  // Fetch compliance history
  useEffect(() => {
    if (!accessToken) return;
    setIsLoadingHistory(true);
    fetch(`${API_BASE}/api/history?limit=20`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const items: HistoryItem[] = data.items || [];
        setHistory(items);
        // Compute stats
        const passed       = items.filter((i) => i.status === "PASS").length;
        const failed       = items.filter((i) => i.status === "FAIL").length;
        const needs_review = items.filter((i) => i.status === "NEEDS_REVIEW").length;
        const avg_score    = items.length ? Math.round(items.reduce((a, b) => a + b.score, 0) / items.length) : 0;
        setStats({ total: items.length, passed, failed, needs_review, avg_score });
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, [accessToken, authHeaders]);

  // Fetch regulatory alerts
  useEffect(() => {
    if (!accessToken) return;
    setIsLoadingAlerts(true);
    fetch(`${API_BASE}/api/alerts?limit=10`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setAlerts(data.alerts || []))
      .catch(() => {})
      .finally(() => setIsLoadingAlerts(false));
  }, [accessToken, authHeaders]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0a0a0a", color: "#fff", fontFamily: "Barlow, sans-serif" }}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10"
        style={{ background: "rgba(10,10,10,0.9)", backdropFilter: "blur(12px)" }}>
        <span className="text-lg font-bold tracking-wider" style={{ color: "#22c55e" }}>
          PHARMACHECK
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/check")}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            + New Check
          </button>
          <span className="text-sm text-white/40">{user?.email}</span>
          <button
            onClick={() => { logout(); navigate("/auth"); }}
            className="text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-semibold text-white">
            Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Tenant: {user?.tenant_id?.slice(0, 8)}… · Role: {user?.role}
          </p>
        </motion.div>

        {/* Stats cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <StatCard label="Total Checks" value={stats.total} color="#60a5fa" />
          <StatCard label="Passed" value={stats.passed} color="#22c55e" />
          <StatCard label="Failed" value={stats.failed} color="#ef4444" />
          <StatCard label="Avg Risk Score" value={`${stats.avg_score}/100`} color={stats.avg_score >= 75 ? "#ef4444" : stats.avg_score >= 50 ? "#f97316" : "#22c55e"} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History table */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 rounded-xl border border-white/10 p-5"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <h2 className="text-base font-semibold text-white mb-4">Recent Compliance Checks</h2>
            {isLoadingHistory ? (
              <div className="text-white/30 text-sm py-8 text-center">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="text-white/30 text-sm py-8 text-center">
                No checks yet.{" "}
                <button onClick={() => navigate("/check")} className="text-emerald-400 hover:underline">
                  Run your first check →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <HistoryRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </motion.div>

          {/* Regulatory alerts */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-white/10 p-5"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Regulatory Alerts</h2>
              <span className="text-xs text-white/30">FDA · EMA</span>
            </div>
            {isLoadingAlerts ? (
              <div className="text-white/30 text-sm py-8 text-center">Loading alerts…</div>
            ) : alerts.length === 0 ? (
              <div className="text-white/30 text-sm py-8 text-center">No recent alerts</div>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 6).map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      className="rounded-xl border border-white/10 p-4"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <div className="text-2xl font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const statusColor =
    item.status === "PASS"         ? "#22c55e" :
    item.status === "FAIL"         ? "#ef4444" :
    item.status === "NEEDS_REVIEW" ? "#f59e0b" : "#888";

  const date = new Date(item.created_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 hover:border-white/10 transition-colors"
      style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-3">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: statusColor }}
        />
        <div>
          <div className="text-sm text-white/80">{item.status}</div>
          <div className="text-xs text-white/30">{date}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono" style={{ color: item.score >= 75 ? "#ef4444" : item.score >= 50 ? "#f97316" : "#22c55e" }}>
          {item.score}
        </div>
        <div className="text-xs text-white/30">{item.violation_count} violations</div>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const sColor =
    alert.severity === "critical" ? "#ef4444" :
    alert.severity === "high"     ? "#f97316" :
    alert.severity === "medium"   ? "#f59e0b" : "#22c55e";

  return (
    <div className="rounded-lg border border-white/5 p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: sColor }} />
        <div className="min-w-0">
          <p className="text-xs text-white/70 font-medium leading-snug line-clamp-2">{alert.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs" style={{ color: sColor }}>{alert.severity}</span>
            <span className="text-xs text-white/20">{alert.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
