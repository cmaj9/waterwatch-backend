-- =============================================================
-- Migration: Add users table
-- Run AFTER init.sql
-- Command: psql -U postgres -d water_monitor -f sql/add_users.sql
-- =============================================================

-- ── ENUM for user role ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('citizen', 'staff', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TABLE: users ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  phone         VARCHAR(20),
  role          "UserRole"    NOT NULL DEFAULT 'citizen',
  district      VARCHAR(100),
  line_user_id  VARCHAR(100),           -- LINE userId สำหรับ Multicast notification
  station_ids   TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],  -- สถานีที่ user รับผิดชอบ
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- ── Auto-update updated_at trigger ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── NOTE ──────────────────────────────────────────────────────
-- Seed data (with bcrypt hashed passwords) will be inserted by:
--   node src/scripts/seedUsers.js
-- All accounts use password: demo1234

SELECT 'users table created successfully!' AS message;
