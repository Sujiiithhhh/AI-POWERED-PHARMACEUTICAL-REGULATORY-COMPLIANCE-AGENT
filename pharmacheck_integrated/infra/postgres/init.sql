-- PharmaCheck PostgreSQL initialisation
-- Creates extensions and sets timezone
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for ILIKE text search
SET timezone = 'UTC';
