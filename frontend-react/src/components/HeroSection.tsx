import { Suspense, lazy } from "react";

// Lazy-load Spline so the 3D scene doesn't block initial render
const Spline = lazy(() => import("@splinetool/react-spline"));

const SPLINE_SCENE =
  "https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-end bg-hero-bg overflow-hidden">

      {/* ── Spline 3D background ── */}
      <div className="absolute inset-0">
        <Suspense
          fallback={<div className="absolute inset-0 bg-hero-bg" />}
        >
          <Spline scene={SPLINE_SCENE} className="w-full h-full" />
        </Suspense>
      </div>

      {/* ── Dark overlay so text stays readable ── */}
      <div className="absolute inset-0 bg-black/30 z-[1] pointer-events-none" />

      {/* ── Hero content — bottom-left, passes clicks through to Spline ── */}
      <div className="relative z-10 pointer-events-none w-full max-w-[90%] sm:max-w-md lg:max-w-2xl px-6 md:px-10 pb-10 pt-32">

        {/* Heading */}
        <h1
          className="opacity-0 animate-fade-up font-bold leading-[1.05] tracking-[-0.05em] text-foreground mb-2 md:mb-4 uppercase"
          style={{
            fontSize: "clamp(3rem, 8vw, 6rem)",
            animationDelay: "0.2s",
          }}
        >
          PHARMACHECK
          <span className="text-primary"> AI</span>
        </h1>

        {/* Subheading */}
        <p
          className="opacity-0 animate-fade-up text-foreground/80 font-light mb-3 md:mb-6"
          style={{
            fontSize: "clamp(1.125rem, 2.5vw, 1.875rem)",
            animationDelay: "0.4s",
          }}
        >
          We implement compliance correctly.
        </p>

        {/* Description */}
        <p
          className="opacity-0 animate-fade-up text-muted-foreground font-light mb-4 md:mb-8"
          style={{
            fontSize: "clamp(0.875rem, 1.5vw, 1.25rem)",
            animationDelay: "0.55s",
          }}
        >
          Regulatory violations detected in seconds. RAG-powered policy
          retrieval grounded in FDA, EMA, HIPAA, and ICH E2D guidelines.
          Corrective recommendations delivered at submission time. All of it
          done right, not just fast.
        </p>

        {/* CTA buttons */}
        <div
          className="opacity-0 animate-fade-up flex flex-wrap gap-3 font-bold"
          style={{ animationDelay: "0.7s" }}
        >
          <button
            className="pointer-events-auto bg-primary text-primary-foreground px-6 py-3 md:px-8 md:py-4 text-sm rounded-sm cursor-pointer hover:brightness-110 transition-all active:scale-[0.97]"
          >
            Request Demo
          </button>
          <button
            className="pointer-events-auto bg-white text-background px-6 py-3 md:px-8 md:py-4 text-sm rounded-sm cursor-pointer hover:brightness-90 transition-all active:scale-[0.97]"
          >
            Case Studies
          </button>
        </div>

        {/* Trust line */}
        <p
          className="opacity-0 animate-fade-up text-muted-foreground/60 text-xs font-light mt-4 md:mt-6"
          style={{ animationDelay: "0.85s" }}
        >
          Trusted compliance intelligence. FDA · EMA · HIPAA · ICH E2D · CDSCO.
          9 regulatory frameworks indexed.
        </p>
      </div>
    </section>
  );
}
