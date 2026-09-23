-- Migration: Create line_subscribers table
-- Stores LINE subscribers who add friend or interact with the bot
-- Keeps the main `users` table clean for actual staff/admin accounts

CREATE TABLE IF NOT EXISTS line_subscribers (
    subscriber_id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    picture_url TEXT,
    station_ids TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_subscribers_active ON line_subscribers(is_active);
CREATE INDEX IF NOT EXISTS idx_line_subscribers_line_user_id ON line_subscribers(line_user_id);
