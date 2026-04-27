"""
OpenTelemetry Distributed Tracing — Phase 5
=============================================
Sets up OTLP exporter and auto-instruments FastAPI + SQLAlchemy.

Usage (in main.py):
    from backend.telemetry import setup_tracing
    setup_tracing(app)

Environment variables:
    OTEL_EXPORTER_OTLP_ENDPOINT    http://otel-collector:4317
    OTEL_SERVICE_NAME               pharmacheck-api
    OTEL_ENABLED                    1 (default 1)
"""

import logging
import os

logger = logging.getLogger(__name__)

OTEL_ENABLED  = os.environ.get("OTEL_ENABLED", "1").strip().lower() in ("1", "true", "yes")
SERVICE_NAME  = os.environ.get("OTEL_SERVICE_NAME", "pharmacheck-api")
OTLP_ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "")


def setup_tracing(app=None):
    """
    Initialise OpenTelemetry with OTLP gRPC exporter.
    Safe to call even if opentelemetry packages are not installed.
    """
    if not OTEL_ENABLED:
        logger.debug("OpenTelemetry disabled via OTEL_ENABLED=0")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({"service.name": SERVICE_NAME})
        provider = TracerProvider(resource=resource)

        # OTLP exporter (gRPC)
        if OTLP_ENDPOINT:
            try:
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
                exporter = OTLPSpanExporter(endpoint=OTLP_ENDPOINT, insecure=True)
                provider.add_span_processor(BatchSpanProcessor(exporter))
                logger.info("OTLP trace exporter → %s", OTLP_ENDPOINT)
            except ImportError:
                logger.warning("opentelemetry-exporter-otlp not installed — traces won't be exported")
        else:
            # Console exporter for dev
            from opentelemetry.sdk.trace.export import ConsoleSpanExporter
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
            logger.info("OTLP endpoint not set — using console exporter")

        trace.set_tracer_provider(provider)

        # Auto-instrument FastAPI
        if app is not None:
            try:
                from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
                FastAPIInstrumentor.instrument_app(app)
                logger.info("FastAPI auto-instrumented")
            except ImportError:
                pass

        # Auto-instrument SQLAlchemy
        try:
            from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
            SQLAlchemyInstrumentor().instrument()
            logger.info("SQLAlchemy auto-instrumented")
        except ImportError:
            pass

        # Auto-instrument httpx
        try:
            from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
            HTTPXClientInstrumentor().instrument()
            logger.info("HTTPX auto-instrumented")
        except ImportError:
            pass

        logger.info("OpenTelemetry tracing initialised for service '%s'", SERVICE_NAME)

    except ImportError as exc:
        logger.warning("OpenTelemetry not installed (%s) — tracing disabled", exc)
    except Exception as exc:
        logger.error("OpenTelemetry setup failed: %s", exc)


def get_tracer(name: str = SERVICE_NAME):
    """Get a named tracer. Returns a no-op tracer if OTel is not set up."""
    try:
        from opentelemetry import trace
        return trace.get_tracer(name)
    except ImportError:
        return _NoopTracer()


class _NoopTracer:
    """Fallback when OTel is not installed."""
    def start_as_current_span(self, *args, **kwargs):
        from contextlib import contextmanager
        @contextmanager
        def _noop():
            yield None
        return _noop()
