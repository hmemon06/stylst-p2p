-- Run this in your Supabase SQL Editor to immediately fix your account
-- Replace YOUR_DEVICE_UUID with your actual device UUID

-- Update your account to premium with 200 credits
UPDATE users
SET
  is_premium = true,
  plan = 'yearly',
  redesign_credits = 200,
  updated_at = NOW()
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';

-- Verify the update
SELECT
  device_uuid,
  is_premium,
  plan,
  redesign_credits,
  scan_count
FROM users
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';
