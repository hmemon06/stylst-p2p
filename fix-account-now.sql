-- Quick fix for your account
-- Just add the missing columns and set your premium status

-- Add missing columns to users table (safe to run multiple times)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_credited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;

-- Update your account with premium + 200 credits
UPDATE users
SET
  is_premium = true,
  plan = 'yearly',
  redesign_credits = 200,
  last_credited_at = NOW(),
  subscription_started_at = NOW(),
  updated_at = NOW()
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';

-- Verify it worked
SELECT
  device_uuid,
  is_premium,
  plan,
  redesign_credits,
  scan_count,
  last_credited_at,
  subscription_started_at
FROM users
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';
