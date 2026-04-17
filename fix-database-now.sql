-- Fix Database Schema for Credit Tracking
-- Run this in Supabase SQL Editor

-- Step 1: Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_credited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Verify columns were added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('last_credited_at', 'subscription_started_at', 'redesign_credits', 'is_premium', 'plan');

-- Step 3: Fix your account
UPDATE users
SET
  is_premium = true,
  plan = 'yearly',
  redesign_credits = 200,
  last_credited_at = NOW(),
  subscription_started_at = NOW(),
  updated_at = NOW()
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';

-- Step 4: Verify your account
SELECT
  device_uuid,
  is_premium,
  plan,
  redesign_credits,
  scan_count,
  last_credited_at,
  subscription_started_at,
  created_at,
  updated_at
FROM users
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';

-- Step 5: Refresh schema cache (forces Supabase to recognize new columns)
NOTIFY pgrst, 'reload schema';

-- Done! You should see:
-- - is_premium: true
-- - plan: yearly
-- - redesign_credits: 200
-- - last_credited_at: current timestamp
-- - subscription_started_at: current timestamp
