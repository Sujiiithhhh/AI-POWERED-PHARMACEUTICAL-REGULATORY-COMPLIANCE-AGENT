"""
PharmaCheck — Security Middleware Stack
=======================================
Four layers in registration order (applied bottom-up by Starlette):

  Layer A — Security headers       (every response)
  Layer B — Input sanitisation     (every request with a body)
  Layer C — Request timing + size  (every request)

Honeypot endpoint and file-upload guard are in security.py (separate router).
"""

import re
import time
import html
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response, JSONResponse

# ─────────────────────────────────────────────────────────────────────────────
# Layer A — Security Headers
# Targets A+ on https://securityheaders.com
# ─────────────────────────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject hardened HTTP security headers on every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        # ── Timing ────────────────────────────────────────────────────────────
        # Added by RequestTimingMiddleware — not duplicated here

        # ── Anti-clickjacking ─────────────────────────────────────────────────
        response.headers["X-Frame-Options"]        = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"]       = "1; mode=block"

        # ── Referrer ──────────────────────────────────────────────────────────
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # ── Permissions ───────────────────────────────────────────────────────
        response.headers["Permissions-Policy"] = (
            "geolocation=(), camera=(), microphone=(), "
            "payment=(), usb=(), interest-cohort=()"
        )

        # ── HSTS ─────────────────────────────────────────────────────────────
        # Enable only behind HTTPS. Uncomment when deployed:
        # response.headers["Strict-Transport-Security"] = (
        #     "max-age=63072000; includeSubDomains; preload"
        # )

        # ── Content-Security-Policy ───────────────────────────────────────────
        # Allows: self, Google Fonts, jsdelivr CDN for world map topojson,
        #         LLM provider APIs (for the compliance engine)
        response.headers["Content-Security-Policy"] = "; ".join([
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   # Vite/React needs this
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https://cdn.jsdelivr.net",
            "connect-src 'self' "
                "https://generativelanguage.googleapis.com "
                "https://api.groq.com "
                "https://api.openai.com "
                "https://cdn.jsdelivr.net",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ])

        # ── Strip server fingerprint ──────────────────────────────────────────
        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        return response


# ─────────────────────────────────────────────────────────────────────────────
# Layer B — Input Sanitisation
# Strips NUL bytes, rejects suspiciously large payloads,
# logs patterns indicative of injection attacks.
# ─────────────────────────────────────────────────────────────────────────────

# Patterns that suggest prompt-injection or XSS probing
_INJECTION_PATTERNS = [
    re.compile(r"<script[\s>]", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"on\w+\s*=", re.IGNORECASE),        # onclick= etc.
    re.compile(r";\s*DROP\s+TABLE", re.IGNORECASE),  # SQL drop
    re.compile(r"UNION\s+SELECT", re.IGNORECASE),    # SQL union
    re.compile(r"\.\./\.\./", re.IGNORECASE),        # path traversal
]

MAX_BODY_BYTES = 512 * 1024   # 512 KB hard limit


class InputSanitisationMiddleware(BaseHTTPMiddleware):
    """
    Inspect and sanitise request bodies before they reach any endpoint.
    - Rejects bodies over MAX_BODY_BYTES
    - Strips NUL bytes
    - Flags (but does NOT block) injection probe patterns — logs them instead
      so legitimate security-research reports aren't rejected
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        content_type = request.headers.get("content-type", "")

        if "application/json" in content_type:
            body_bytes = await request.body()

            # Size guard
            if len(body_bytes) > MAX_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request body exceeds {MAX_BODY_BYTES // 1024} KB limit."},
                )

            # NUL-byte stripping (can crash some parsers)
            cleaned = body_bytes.replace(b"\x00", b"")

            # Injection pattern detection — log only, do not reject
            # (pharma reports legitimately contain medical terminology that
            #  might resemble injection strings)
            text_preview = cleaned[:2000].decode("utf-8", errors="ignore")
            for pattern in _INJECTION_PATTERNS:
                if pattern.search(text_preview):
                    # In production: emit a security alert here
                    # For now just add a header so you can see it in logs
                    response = await call_next(request)
                    response.headers["X-Security-Flag"] = "injection-probe-detected"
                    return response

            # Rebuild request with cleaned body
            async def receive():
                return {"type": "http.request", "body": cleaned, "more_body": False}

            request = Request(request.scope, receive)

        return await call_next(request)


# ─────────────────────────────────────────────────────────────────────────────
# Layer C — Request Timing + Size
# ─────────────────────────────────────────────────────────────────────────────

class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Add X-Process-Time to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        t0 = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Process-Time"] = f"{(time.perf_counter() - t0) * 1000:.1f}ms"
        return response
