# Subscription & Credits Fix Guide

## Problems Solved

### 1. **Duplicate Credit Prevention**
- ✅ Users can no longer sync multiple times to get free credits
- ✅ Transaction tracking prevents processing the same webhook event twice
- ✅ Database-level unique constraint on `transaction_id`

### 2. **Recurring Credits on Renewal**
- ✅ Users get credits every time their subscription renews
- ✅ Weekly plan: 3 credits per week
- ✅ Monthly plan: 15 credits per month
- ✅ Yearly plan: 200 credits per year

### 3. **Credit Amounts Standardized**
- Yearly: 200 credits
- Monthly: 15 credits
- Weekly: 3 credits

---

## Setup Instructions

### Step 1: Create Transactions Table (Required)

Run this in your Supabase SQL Editor:

```sql
-- See: supabase-migration-transactions.sql
-- This creates the transactions table to track processed webhook events
```

Copy and run the SQL from [supabase-migration-transactions.sql](supabase-migration-transactions.sql)

**What this does:**
- Creates `transactions` table to track all processed RevenueCat events
- Adds `last_credited_at` column to users (timestamp of last credit grant)
- Adds `subscription_started_at` column to users (for tracking initial purchase)
- Prevents duplicate credit grants via unique constraint on `transaction_id`

### Step 2: Deploy Updated Webhook

Deploy the fixed webhook code from [supabase-webhook-revenuecat.ts](supabase-webhook-revenuecat.ts) to your Supabase Edge Function.

**Key Features:**
1. **Duplicate Prevention:**
   ```typescript
   // Checks if transaction was already processed
   const { data: existingTransaction } = await supabase
     .from("transactions")
     .select("transaction_id")
     .eq("transaction_id", transactionId)
     .single();

   if (existingTransaction) {
     console.log("Already processed, skipping");
     return; // No credits granted
   }
   ```

2. **Recurring Credits:**
   ```typescript
   // INITIAL_PURCHASE: First-time subscriber gets credits
   // RENEWAL: Existing subscriber gets credits again
   const isPremiumEvent = [
     "INITIAL_PURCHASE",  // New subscriber
     "RENEWAL",           // Subscription renews (weekly/monthly/yearly)
     "UNCANCELLATION",    // User reactivates
     "NON_RENEWING_PURCHASE"
   ];
   ```

3. **Transaction Tracking:**
   ```typescript
   // After granting credits, record the transaction
   await supabase.from("transactions").insert({
     transaction_id: transactionId,
     device_uuid: appUserId,
     event_type: eventType,
     product_id: productId,
     credits_granted: creditsToGrant,
   });
   ```

### Step 3: Fix Your Account Now

Run this SQL to immediately fix your account:

```sql
-- Update your account with correct credits
UPDATE users
SET
  is_premium = true,
  plan = 'yearly',
  redesign_credits = 200,
  last_credited_at = NOW(),
  subscription_started_at = NOW(),
  updated_at = NOW()
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';
```

### Step 4: Restart Your App

After running the SQL:
1. Close and reopen your app
2. The app will sync with the database and show your 200 credits
3. Premium features should be unlocked

---

## How It Works

### Initial Purchase Flow:

```
User buys yearly plan
    ↓
RevenueCat sends webhook: INITIAL_PURCHASE
    ↓
Webhook checks: Has this transaction_id been processed?
    ↓
No → Grant 200 credits + record transaction
    ↓
User has 200 credits, is_premium = true
```

### Renewal Flow (Every Year):

```
Subscription renews after 1 year
    ↓
RevenueCat sends webhook: RENEWAL
    ↓
Webhook checks: Has this transaction_id been processed?
    ↓
No → Grant 200 MORE credits + record transaction
    ↓
User now has (old_credits + 200), is_premium = true
```

### Duplicate Prevention:

```
User tries to sync multiple times / Webhook retries
    ↓
Webhook receives same transaction_id
    ↓
Checks transactions table: Already exists?
    ↓
Yes → Skip credit grant, return success
    ↓
No duplicate credits granted ✅
```

---

## Credit Amounts by Plan

| Plan | Credits per Period | How Often |
|------|-------------------|-----------|
| Weekly | 3 credits | Every 7 days |
| Monthly | 15 credits | Every 30 days |
| Yearly | 200 credits | Every 365 days |

**Note:** Credits accumulate. If a yearly subscriber renews, they get +200 credits added to their existing balance.

---

## Testing

### Test Initial Purchase:
1. Make a purchase (or use a test account)
2. Check Supabase logs: Should see "NEW SUBSCRIBER"
3. Verify `transactions` table has a new row
4. Verify user got credits

### Test Renewal:
1. Wait for renewal (or trigger test renewal in RevenueCat)
2. Check Supabase logs: Should see "RENEWAL"
3. Verify `transactions` table has new row with different transaction_id
4. Verify user got ADDITIONAL credits (not replaced)

### Test Duplicate Prevention:
1. Send same webhook payload twice
2. First: Credits granted
3. Second: "Already processed, skipping"
4. Verify credits only granted once

---

## Monitoring

### Check Recent Transactions:
```sql
SELECT
  transaction_id,
  device_uuid,
  event_type,
  product_id,
  credits_granted,
  processed_at
FROM transactions
ORDER BY processed_at DESC
LIMIT 20;
```

### Check User Credits:
```sql
SELECT
  device_uuid,
  is_premium,
  plan,
  redesign_credits,
  last_credited_at,
  subscription_started_at
FROM users
WHERE device_uuid = 'YOUR_UUID';
```

### Find Duplicate Transaction Attempts:
```sql
SELECT
  transaction_id,
  COUNT(*) as attempts
FROM transactions
GROUP BY transaction_id
HAVING COUNT(*) > 1;
-- Should return 0 rows if working correctly
```

---

## Troubleshooting

### "User still not showing as premium"
- Run the SQL fix for your account
- Call `refreshPremiumStatus()` in app
- Check RevenueCat logs to ensure webhook is configured

### "Credits not updating"
- Check Supabase Edge Function logs
- Verify transactions table was created
- Ensure webhook URL is correct in RevenueCat dashboard

### "Getting duplicate credits"
- Check if transactions table exists
- Verify unique constraint on transaction_id
- Review Edge Function logs for errors

---

## Code Changes Summary

### Files Modified:
1. ✅ [lib/supabase.ts](lib/supabase.ts) - Updated credit amounts (15 monthly, 3 weekly)
2. ✅ [lib/deviceAuth.tsx](lib/deviceAuth.tsx) - Enhanced `refreshPremiumStatus()` to sync credits
3. ✅ [app/score.tsx](app/score.tsx) - Fixed credit deduction (backend is source of truth)

### Files Created:
1. 📄 [supabase-webhook-revenuecat.ts](supabase-webhook-revenuecat.ts) - Complete webhook with duplicate prevention
2. 📄 [supabase-migration-transactions.sql](supabase-migration-transactions.sql) - Database migration
3. 📄 [fix-my-subscription.sql](fix-my-subscription.sql) - Quick fix for your account

---

## Security Notes

- Transaction IDs are unique per RevenueCat event
- Database enforces unique constraint (duplicate inserts fail)
- Webhook idempotent (safe to call multiple times with same data)
- No client-side credit manipulation possible
- All credit grants logged in transactions table for audit
