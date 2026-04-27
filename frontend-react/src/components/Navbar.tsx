import { Button } from "./ui/button";

const NAV_LINKS = [
  { label: "Solutions", href: "#solutions" },
  { label: "About Us", href: "#about" },
  { label: "Regulations", href: "#regulations" },
  { label: "Research", href: "#research" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-16 py-5">
      {/* ── Logo ── */}
      <a
        href="/"
        className="text-foreground text-xl font-semibold tracking-tight select-none"
      >
        PHARMACHECK
      </a>

      {/* ── Nav links (desktop only) ── */}
      <nav className="hidden md:flex items-center gap-8">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* ── CTA button (desktop only) ── */}
      <Button
        variant="navCta"
        size="lg"
        className="hidden md:inline-flex rounded-lg px-6"
      >
        Get Demo
      </Button>
    </header>
  );
}
