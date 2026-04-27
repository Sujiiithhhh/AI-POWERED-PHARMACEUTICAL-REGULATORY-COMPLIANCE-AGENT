# PharmaCheck AI — React Frontend

## Quick Start

```bash
cd frontend-react
npm install
npm run dev
```

Open http://localhost:5173

## Build for production

```bash
npm run build       # outputs to dist/
npm run preview     # preview the production build locally
```

## File Structure

```
frontend-react/
├── index.html                    # Sora + Instrument Serif fonts, root div
├── tailwind.config.ts            # Custom HSL tokens, fade-up/fade-in animations
├── postcss.config.cjs
├── vite.config.ts                # @/ alias → src/
├── tsconfig.json
└── src/
    ├── main.tsx                  # ReactDOM.createRoot entry
    ├── index.css                 # HSL CSS custom properties + Tailwind directives
    ├── App.tsx                   # AppWrapper: AnimatePresence + isLoading state
    ├── lib/
    │   └── utils.ts              # cn() helper (clsx + tailwind-merge)
    └── components/
        ├── LoadingScreen.tsx     # Framer Motion loader (Analyze → Detect → Comply)
        ├── Navbar.tsx            # Fixed transparent navbar
        ├── HeroSection.tsx       # Full-screen hero with lazy Spline 3D background
        └── ui/
            └── button.tsx        # shadcn Button with navCta variant

## Timing Flow

| Time  | Event                                    |
|-------|------------------------------------------|
| 0.0s  | Loader appears, counter starts at 000    |
| 0.0s  | "Analyze" appears                        |
| 0.9s  | "Detect" replaces "Analyze"              |
| 1.8s  | "Comply" replaces "Detect"               |
| 2.7s  | Counter hits 100, progress bar full      |
| 3.1s  | onComplete fires (400ms delay)           |
| 3.1s  | Loader fades out (0.6s exit)             |
| 3.7s  | Hero page fades in (0.5s opacity)        |

## Colour Tokens

| Token           | Value            | Usage                    |
|-----------------|------------------|--------------------------|
| --primary       | 119 99% 46%      | Vivid green — brand      |
| --hero-bg       | 0 0% 8%          | Near-black page bg       |
| --nav-button    | 0 0% 18%         | "Get Demo" button bg     |
| --muted-foreground | 0 0% 60%      | Body text, labels        |

## Connecting to the Backend

The backend runs on FastAPI. Point the CTA buttons to `/check_compliance`:

```ts
// In HeroSection.tsx — "Request Demo" button onClick:
fetch("http://localhost:8000/check_compliance", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ report_text: "..." }),
})
```
