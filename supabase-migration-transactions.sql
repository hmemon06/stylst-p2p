-- Migration: Add transactions table to track processed RevenueCat events
-- This prevents duplicate credit grants from webhook retries or multiple syncs

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE, -- RevenueCat transaction ID
  device_uuid TEXT NOT NULL REFERENCES users(device_uuid) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- INITIAL_PURCHASE, RENEWAL, etc.
  product_id TEXT NOT NULL,
  credits_granted INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Indexes for fast lookups
  CONSTRAINT unique_transaction UNIQUE(transaction_id)
);

-- Index for querying by device
CREATE INDEX IF NOT EXISTS idx_transactions_device_uuid ON transactions(device_uuid);

-- Index for querying by transaction_id (for duplicate checking)
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);

-- Add last_credited_at to users table to track when they last received credits
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_credited_at TIMESTAMP  WITH TIME ZONE;

-- Add subscription_started_at to track initial purchase date
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;

-- Comment for documentation
COMMENT ON TABLE transactions IS 'Tracks processed RevenueCat webhook events to prevent duplicate credit grants';
COMMENT ON COLUMN transactions.transaction_id IS 'Unique transaction ID from RevenueCat webhook';
COMMENT ON COLUMN transactions.credits_granted IS 'Number of credits granted for this transaction';
COMMENT ON COLUMN users.last_credited_at IS 'Timestamp of last credit grant (prevents duplicate grants from same renewal period)';
COMMENT ON COLUMN users.subscription_started_at IS 'When the user first subscribed (for INITIAL_PURCHASE only)';
