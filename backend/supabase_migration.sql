-- Supabase Migration: Device Trial Tracking
-- Run this SQL in your Supabase SQL Editor to set up the database schema

-- Create the users table for device-based trial tracking + basic subscription/account linkage
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  device_uuid TEXT NOT NULL UNIQUE,
  scan_count INTEGER DEFAULT 0 NOT NULL,
  is_premium BOOLEAN DEFAULT FALSE NOT NULL,
  -- Subscription + entitlement fields used by the mobile app
  plan TEXT DEFAULT 'free', -- 'free', 'weekly', 'monthly', 'yearly'
  redesign_credits INTEGER DEFAULT 1,
  -- Optional account linkage fields (when user signs in)
  email TEXT,
  apple_id TEXT,
  google_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- If you've run an older version of this migration, these ensure columns are added safely.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS redesign_credits INTEGER DEFAULT 1;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS apple_id TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Ensure defaults are set even if columns already existed
ALTER TABLE users
  ALTER COLUMN plan SET DEFAULT 'free';

ALTER TABLE users
  ALTER COLUMN redesign_credits SET DEFAULT 1;

-- Update existing users who don't have redesign credits set (give them the onboarding gift)
UPDATE users
  SET redesign_credits = 1
  WHERE redesign_credits IS NULL OR redesign_credits = 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_date TIMESTAMP WITH TIME ZONE;


-- Create an index on device_uuid for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_device_uuid ON users(device_uuid);

-- Optional indexes for account lookup/debugging
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Create a function to increment scan count atomically
CREATE OR REPLACE FUNCTION increment_scan_count(uuid TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users
  SET scan_count = scan_count + 1,
      updated_at = NOW()
  WHERE device_uuid = uuid;
END;
$$;

-- Create a trigger to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for analytics
CREATE OR REPLACE VIEW trial_stats AS
SELECT
  COUNT(*) FILTER (WHERE is_premium = FALSE AND scan_count >= 3) AS trial_ended_count,
  COUNT(*) FILTER (WHERE is_premium = TRUE) AS premium_count,
  COUNT(*) FILTER (WHERE is_premium = FALSE AND scan_count < 3) AS active_trial_count,
  AVG(scan_count) FILTER (WHERE is_premium = FALSE) AS avg_trial_scans
FROM users;

-- Insert test data (optional - remove in production)
-- INSERT INTO users (device_uuid, scan_count, is_premium)
-- VALUES ('test-device-1', 0, false);

-- Grant necessary permissions (adjust for your Row Level Security policy)
-- If you're using RLS, you'll need to create policies
-- For now, this assumes service role access from backend

-- ============================================================================
-- OUTFITS TABLE (Async Redesigns & History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS outfits (
  id BIGSERIAL PRIMARY KEY,
  device_uuid TEXT NOT NULL, -- Linked to users.device_uuid
  original_image_url TEXT NOT NULL,
  redesign_image_url TEXT,
  prompt TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for fast lookup by device
CREATE INDEX IF NOT EXISTS idx_outfits_device_uuid ON outfits(device_uuid);

-- Trigger to auto-update updated_at for outfits
CREATE TRIGGER update_outfits_updated_at
  BEFORE UPDATE ON outfits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION: ADD RATING DATA TO OUTFITS (Scorecard History)
-- Run this block if you already created the outfits table
-- ============================================================================
ALTER TABLE outfits
  ADD COLUMN IF NOT EXISTS score INTEGER,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS rating_data JSONB,
  ADD COLUMN IF NOT EXISTS original_image_storage_path TEXT;

-- Update status check constraint if needed (or just document it)
-- We'll use status='rated' for initial ratings

-- ============================================================================
-- SUBSCRIPTION EVENTS TABLE (Revenue Cat Webhook Logging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_events (
  id BIGSERIAL PRIMARY KEY,
  device_uuid TEXT NOT NULL, -- Linked to users.device_uuid
  event_type TEXT NOT NULL, -- 'initial_purchase', 'renewal', 'cancellation', 'expiration', etc.
  product_id TEXT, -- e.g., 'com.anonymous.stylistai.yearly'
  revenue_usd DECIMAL(10, 2), -- Revenue in USD
  platform TEXT DEFAULT 'unknown', -- 'ios', 'android', 'stripe', etc.
  raw_event JSONB, -- Full webhook payload for debugging
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for fast lookup by device and event type
CREATE INDEX IF NOT EXISTS idx_subscription_events_device_uuid ON subscription_events(device_uuid);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);

-- ============================================================================
-- STRIPE INTEGRATION (Superwall Payment Sheet)
-- ============================================================================

-- Add Stripe-specific columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Tracks which payment platform the user is on ('iap' or 'stripe')
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_platform TEXT DEFAULT 'iap';

-- Timestamp for when credits were last granted (used by both RevenueCat and Stripe webhooks)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_credited_at TIMESTAMP WITH TIME ZONE;

-- Timestamp for when subscription started (if not already present)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;

-- Index for looking up users by Stripe customer/subscription ID (used by webhook)
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);

-- ============================================================================
-- PROCESSED TRANSACTIONS TABLE (Webhook Deduplication)
-- Used by both RevenueCat and Stripe webhooks to prevent duplicate credit grants
-- ============================================================================
CREATE TABLE IF NOT EXISTS processed_transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE,
  user_id BIGINT, -- References users.id
  event_type TEXT NOT NULL,
  product_id TEXT,
  credits_granted INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_transactions_id ON processed_transactions(transaction_id);
