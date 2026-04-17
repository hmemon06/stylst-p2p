# Testing Credit Purchases - Quick Guide

## Your Products

From your RevenueCat setup:

| Package | Credits | Price | Product ID |
|---------|---------|-------|------------|
| 3 Redesign Pack | 3 credits | $1.99 | `com.stylst.app.redesigns.3pack` |
| 10 Redesign Pack | 10 credits | $4.99 | `com.stylst.app.redesigns.10pack` |
| 25 Redesign Pack | 25 credits | $9.99 | `com.stylst.app.redesigns.25pack` |

---

## Yes, Everything Should Work! ✅

When someone buys a redesign pack:
1. Apple processes the payment
2. RevenueCat receives the purchase
3. RevenueCat sends webhook to your Supabase function (same one that handles subscriptions)
4. Your webhook:
   - Detects `NON_RENEWING_PURCHASE` event
   - Matches product ID (e.g., `com.stylst.app.redesigns.10pack` → 10 credits)
   - Grants +10 credits
   - Records transaction (prevents duplicates)
   - Does NOT set premium or plan

---

## How to Test

### Method 1: Manual Webhook Test (Fastest)

Send test webhooks directly to your Supabase function:

#### Test 3-Pack Purchase
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "com.stylst.app.redesigns.3pack",
      "id": "test_3pack_001"
    }
  }'
```

**Expected Result:**
- Your credits increase by +3
- Supabase logs show: `✅ CREDIT PURCHASE 7a6eacd5-0e97-4195-93fa-149b245d0d6b: credits +3 → 203 total`

#### Test 10-Pack Purchase
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "com.stylst.app.redesigns.10pack",
      "id": "test_10pack_001"
    }
  }'
```

**Expected Result:**
- Your credits increase by +10
- Total: 213 credits

#### Test 25-Pack Purchase
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "com.stylst.app.redesigns.25pack",
      "id": "test_25pack_001"
    }
  }'
```

**Expected Result:**
- Your credits increase by +25
- Total: 238 credits

---

### Method 2: RevenueCat Test Webhook

Use RevenueCat's built-in webhook tester:

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Navigate to **Integrations** → **Webhooks**
3. Find your Supabase webhook URL
4. Click **"Test Webhook"**
5. Select event type: `NON_RENEWING_PURCHASE`
6. Choose product: `com.stylst.app.redesigns.10pack`
7. Enter test user ID: `test-user-123`
8. Click **Send Test**

**Check:**
- RevenueCat shows "200 OK" response
- Supabase logs show the event
- Database updated with credits

---

### Method 3: Sandbox Purchase (Most Realistic)

Test with Apple's sandbox environment:

#### Setup:
1. Create a **Sandbox Tester** in App Store Connect:
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Users and Access → Sandbox Testers
   - Click **+** to add tester
   - Use a NEW email (not your real Apple ID)
   - Save credentials

2. **Sign out** of your real Apple ID on your test device:
   - Settings → App Store → Sign Out

3. Build and install your app (TestFlight or development build)

#### Test Flow:
1. Open your app
2. Run out of redesign credits (or manually set to 0 in database)
3. Trigger the paywall (try to redesign when at 0 credits)
4. Superwall shows your `on_pro_out_of_redesigns` paywall
5. Select "10 Redesign Pack" ($4.99)
6. Apple prompts for payment → **Sign in with Sandbox Tester**
7. Apple shows "Environment: Sandbox" (confirms it's a test)
8. Approve purchase

**What happens:**
1. Apple processes (no real charge)
2. RevenueCat receives purchase event
3. Webhook fires → Your Supabase function
4. Database updated with +10 credits
5. App syncs and shows new balance

#### Check Results:
```sql
-- Check your credits
SELECT
  device_uuid,
  redesign_credits,
  is_premium,
  plan,
  last_credited_at
FROM users
WHERE device_uuid = 'YOUR_DEVICE_UUID';

-- Check transaction was recorded
SELECT
  t.transaction_id,
  t.event_type,
  t.product_id,
  t.credits_granted,
  t.processed_at
FROM processed_transactions t
JOIN users u ON t.user_id = u.id
WHERE u.device_uuid = 'YOUR_DEVICE_UUID'
ORDER BY t.processed_at DESC
LIMIT 5;
```

---

### Method 4: Test Duplicate Prevention

Send the **same webhook twice** to ensure no duplicate credits:

```bash
# First call - should grant credits
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "test-user-dupe",
      "product_id": "com.stylst.app.redesigns.10pack",
      "id": "duplicate_test_tx"
    }
  }'

# Second call - should be rejected (same transaction_id)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "test-user-dupe",
      "product_id": "com.stylst.app.redesigns.10pack",
      "id": "duplicate_test_tx"
    }
  }'
```

**Expected Result:**
- First call: `✅ CREDIT PURCHASE test-user-dupe: credits +10 → 10 total`
- Second call: `⚠️ Transaction duplicate_test_tx already processed, skipping to prevent duplicate credits`
- User has 10 credits (not 20)

---

## Verify Setup

Before testing, make sure:

### 1. Webhook URL is Configured in RevenueCat
- Go to RevenueCat → **Integrations** → **Webhooks**
- URL should be: `https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook`
- Status: Active ✅

### 2. Products are Linked to Offering
- Go to RevenueCat → **Offerings** → **stylst_redesigns**
- All 3 packages should be listed:
  - ✅ 3 redesign pack
  - ✅ 10 redesign pack
  - ✅ 25 redesign pack

### 3. Superwall Paywall References Offering
- In Superwall dashboard, find your `on_pro_out_of_redesigns` placement
- Paywall should reference RevenueCat offering: `stylst_redesigns`
- All 3 products should appear as purchasable options

### 4. Database Has Required Tables
```sql
-- Check processed_transactions table exists
SELECT COUNT(*) FROM processed_transactions;

-- Check users table has credit tracking columns
SELECT
  redesign_credits,
  last_credited_at,
  is_premium,
  plan
FROM users
LIMIT 1;
```

---

## Expected Logs

### Supabase Edge Function Logs

When a purchase happens, you should see:

```
Processing NON_RENEWING_PURCHASE for user: 7a6eacd5-0e97-4195-93fa-149b245d0d6b, transaction: abc123xyz, product: com.stylst.app.redesigns.10pack
Granting 10 credits for NON_RENEWING_PURCHASE (product: com.stylst.app.redesigns.10pack)
✅ CREDIT PURCHASE 7a6eacd5-0e97-4195-93fa-149b245d0d6b: credits +10 → 210 total
```

### RevenueCat Dashboard

- Go to **Customers** → Search for your user
- Click on their profile
- **Webhooks** tab should show:
  - Event: `NON_RENEWING_PURCHASE`
  - Product: `com.stylst.app.redesigns.10pack`
  - Status: ✅ Delivered (200)
  - Timestamp

---

## Common Issues & Fixes

### ❌ "Credits not increasing"
**Check:**
1. Supabase Edge Function logs - any errors?
2. RevenueCat webhook delivery status - 200 OK?
3. Product ID matches exactly (case-sensitive!)
4. Transaction recorded in `processed_transactions` table?

**Fix:**
```sql
-- Manually check what happened
SELECT * FROM processed_transactions
WHERE product_id LIKE '%redesigns%'
ORDER BY processed_at DESC
LIMIT 5;
```

---

### ❌ "Webhook returning 500 error"
**Check:**
1. Supabase function deployed?
2. Environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)?
3. Function logs show the error

**Fix:**
```bash
# Redeploy function
supabase functions deploy revenuecat-webhook

# Check logs
supabase functions logs revenuecat-webhook
```

---

### ❌ "Product ID not recognized"
**Check webhook logs** - they'll show the actual product ID RevenueCat sent.

**Fix:** Update the `ONE_TIME_CREDITS` map:
```typescript
const ONE_TIME_CREDITS: Record<string, number> = {
  "actual_product_id_from_logs": 10,
  // ...
};
```

---

## Quick Test Script

Save this as `test-credits.sh`:

```bash
#!/bin/bash

WEBHOOK_URL="https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook"
USER_ID="test-user-$(date +%s)"

echo "Testing 3-pack..."
curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d "{
  \"event\": {
    \"type\": \"NON_RENEWING_PURCHASE\",
    \"app_user_id\": \"$USER_ID\",
    \"product_id\": \"com.stylst.app.redesigns.3pack\",
    \"id\": \"tx_3pack_$(date +%s)\"
  }
}"

sleep 2

echo -e "\n\nTesting 10-pack..."
curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d "{
  \"event\": {
    \"type\": \"NON_RENEWING_PURCHASE\",
    \"app_user_id\": \"$USER_ID\",
    \"product_id\": \"com.stylst.app.redesigns.10pack\",
    \"id\": \"tx_10pack_$(date +%s)\"
  }
}"

sleep 2

echo -e "\n\nTesting 25-pack..."
curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d "{
  \"event\": {
    \"type\": \"NON_RENEWING_PURCHASE\",
    \"app_user_id\": \"$USER_ID\",
    \"product_id\": \"com.stylst.app.redesigns.25pack\",
    \"id\": \"tx_25pack_$(date +%s)\"
  }
}"

echo -e "\n\nDone! Check database for user: $USER_ID"
echo "Expected credits: 3 + 10 + 25 = 38 total"
```

Run it:
```bash
chmod +x test-credits.sh
./test-credits.sh
```

Then verify:
```sql
SELECT
  device_uuid,
  redesign_credits,
  (SELECT COUNT(*) FROM processed_transactions WHERE user_id = users.id) as transaction_count
FROM users
WHERE device_uuid LIKE 'test-user-%'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: 38 credits, 3 transactions
```

---

## Success Checklist

- [ ] Updated webhook deployed to Supabase
- [ ] Manual webhook test (curl) works
- [ ] RevenueCat test webhook returns 200 OK
- [ ] Sandbox purchase completes successfully
- [ ] Credits increase correctly (3, 10, or 25)
- [ ] Transaction recorded in `processed_transactions`
- [ ] Duplicate webhook rejected (no double credits)
- [ ] User does NOT get premium status (only credits)
- [ ] App syncs and displays new credit balance

---

## Summary

**Yes, when someone buys a redesign pack, it will automatically post to your webhook!**

Your setup is correct:
1. ✅ Products in RevenueCat (3pack, 10pack, 25pack)
2. ✅ Webhook updated to handle them
3. ✅ Same webhook as subscriptions
4. ✅ Duplicate prevention built-in
5. ✅ Credits granted without affecting premium status

Just deploy the updated webhook and test with the curl commands above! 🚀
