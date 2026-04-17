-- Add missing columns to existing users table
-- (Safe to run even if columns already exist due to IF NOT EXISTS)

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_credited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;

-- Now fix your account with all the new fields
UPDATE users
SET
  is_premium = true,
  plan = 'yearly',
  redesign_credits = 200,
  last_credited_at = NOW(),
  subscription_started_at = NOW(),
  updated_at = NOW()
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';

-- Verify the update
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
