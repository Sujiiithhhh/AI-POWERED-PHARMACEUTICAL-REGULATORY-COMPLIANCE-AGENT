import { useNavigate } from "react-router-dom";


const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260306_074215_04640ca7-042c-45d6-bb56-58b1e8a42489.mp4";

export default function HeroPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black font-barlow">

      {/* ── Full-screen background video — no overlays, no filters ── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src={VIDEO_URL}
      />

      {/* ── Transparent Navbar ── */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 lg:px-16 py-6">
        <span
          className="text-white font-semibold text-lg tracking-tight cursor-pointer select-none"
          onClick={() => navigate("/")}
        >
          PHARMACHECK
        </span>
        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Home",         path: "/",            active: true  },
            { label: "Check",        path: "/check",       active: false },
            { label: "How it Works", path: "/how-it-works",active: false },
          ].map(({ label, path, active }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="text-sm transition-colors"
              style={{ color: active ? "#fff" : "rgba(255,255,255,0.50)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = active ? "#fff" : "rgba(255,255,255,0.50)")}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Hero content block — centered, bottom-padded ── */}
      <div
        className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-6"
        style={{ paddingBottom: "250px" }}
      >

        {/* ── Featured badge — liquid glass effect ── */}
        <div className="mb-8 opacity-0 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div
            className="inline-flex items-center rounded-full p-[3px] transition-colors cursor-default"
            style={{
              background: "rgba(255,255,255,0.10)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{
                background: "rgba(255,255,255,0.90)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#171717]">
                Powered by Gemini 1.5 Flash · RAG
              </span>
            </div>
          </div>
        </div>

        {/* ── Headline container ── */}
        <div className="relative inline-block px-10 py-8">

          {/* Line 1 — Barlow light */}
          <h1
            className="opacity-0 animate-fade-up text-white font-light leading-tight"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", animationDelay: "0.25s" }}
          >
            Platform that keeps your
          </h1>

          {/* Line 2 — Instrument Serif italic */}
          <h1
            className="opacity-0 animate-fade-up text-white leading-tight"
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              animationDelay: "0.35s",
            }}
          >
            reports &amp; submissions compliant
          </h1>
        </div>

        {/* ── Sub-headline ── */}
        <p
          className="opacity-0 animate-fade-up max-w-xl mt-5 font-barlow font-light leading-relaxed"
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: "clamp(0.95rem, 1.5vw, 1.15rem)",
            animationDelay: "0.5s",
          }}
        >
          Automatically detect FDA, EMA, HIPAA and ICH&nbsp;E2D policy violations
          in medical reports. RAG-powered regulatory clause retrieval with
          corrective recommendations — at submission time.
        </p>

        {/* ── CTA buttons ── */}
        <div
          className="opacity-0 animate-fade-up flex flex-wrap gap-3 mt-8 justify-center"
          style={{ animationDelay: "0.65s" }}
        >
          {/* Primary CTA → checker page */}
          <button
            onClick={() => navigate("/check")}
            className="liquid-glass rounded-full px-8 py-3 text-white font-medium text-[0.95rem] transition-transform hover:scale-[1.03]"
          >
            Check Compliance →
          </button>

          {/* Secondary — How it Works */}
          <button
            onClick={() => navigate("/how-it-works")}
            className="liquid-glass rounded-full px-8 py-3 text-white font-medium text-[0.95rem] transition-transform hover:scale-[1.03]"
          >
            How it Works
          </button>
        </div>
      </div>
    </div>
  );
}
