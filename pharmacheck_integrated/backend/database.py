"""
Async SQLAlchemy setup with PostgreSQL (asyncpg driver).
Falls back to SQLite for local dev when DATABASE_URL is not set.
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# ── Connection URL ────────────────────────────────────────────────────────────
_raw_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./pharmacheck.db")

# Heroku/Render gives postgres:// — SQLAlchemy needs postgresql+asyncpg://
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://") and "+asyncpg" not in _raw_url:
    _raw_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL = _raw_url

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_async_engine(
    DATABASE_URL,
    echo=os.environ.get("SQL_ECHO", "0") == "1",
    pool_pre_ping=True,
    # For SQLite (dev) we need check_same_thread=False via connect_args
    connect_args=(
        {"check_same_thread": False}
        if DATABASE_URL.startswith("sqlite")
        else {}
    ),
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Base class for all models ─────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── FastAPI dependency ────────────────────────────────────────────────────────
async def get_db():
    """Yield an async DB session; close on exit."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Create all tables (called at startup) ─────────────────────────────────────
async def init_db():
    """Create tables if they don't exist. Use Alembic in production."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
