# Testing Guide for Subscription & Credits System

## Quick Test Setup

### 1. Test with Manual Webhook Calls

You can simulate RevenueCat webhooks by sending POST requests to your Supabase Edge Function.

#### Test Initial Purchase:
```bash
curl -X POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "stylst_pro_yearly",
      "id": "test_transaction_001"
    }
  }'
```

**Expected Result:**
- User gets 200 credits
- `is_premium` = true
- `subscription_started_at` set
- Transaction recorded in `processed_transactions`

#### Test Renewal (After 1 Year):
```bash
curl -X POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "RENEWAL",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "stylst_pro_yearly",
      "id": "test_transaction_002"
    }
  }'
```

**Expected Result:**
- User gets +200 MORE credits (total should be 400 if they had 200)
- `is_premium` still true
- `last_credited_at` updated
- New transaction recorded

#### Test Duplicate Prevention:
```bash
# Send the SAME request twice with SAME transaction ID
curl -X POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "RENEWAL",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "stylst_pro_yearly",
      "id": "test_transaction_002"
    }
  }'
```

**Expected Result:**
- Second call: "Already processed, skipping"
- Credits NOT granted again
- User still has 400 credits (not 600)

---

## 2. Test with RevenueCat Sandbox

### Setup RevenueCat Sandbox Testing:

1. **Enable Sandbox Mode in RevenueCat:**
   - Go to RevenueCat Dashboard → Project Settings
   - Use Sandbox API keys for testing

2. **Install TestFlight Build:**
   - Deploy a TestFlight build with RevenueCat configured
   - Use a test Apple ID (not your real one)

3. **Make a Sandbox Purchase:**
   - In TestFlight app, go through the purchase flow
   - Use your Sandbox Apple ID credentials
   - Apple will prompt "This is a test purchase"

4. **Check Logs:**
   - RevenueCat Dashboard → Customers → Find your test user
   - Check webhook delivery status
   - Supabase Edge Functions → Logs

### Accelerate Subscription Renewals:

**In RevenueCat Sandbox, subscriptions renew faster:**
- 1 week subscription → Renews every 3 minutes
- 1 month subscription → Renews every 5 minutes
- 1 year subscription → Renews every 1 hour

**To test yearly renewal quickly:**
1. Create a test product with "1 week" duration
2. Map it to your yearly plan in the app
3. Purchase it in sandbox
4. Wait 3 minutes → Renewal webhook fires!
5. Check credits increased

---

## 3. Verify with SQL Queries

### Check User Credits:
```sql
SELECT
  device_uuid,
  is_premium,
  plan,
  redesign_credits,
  subscription_started_at,
  last_credited_at
FROM users
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';
```

### Check Transaction History:
```sql
SELECT
  t.transaction_id,
  t.event_type,
  t.product_id,
  t.credits_granted,
  t.processed_at,
  u.device_uuid
FROM processed_transactions t
JOIN users u ON t.user_id = u.id
WHERE u.device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b'
ORDER BY t.processed_at DESC;
```

### Check for Duplicate Transactions:
```sql
-- Should return 0 rows if working correctly
SELECT
  transaction_id,
  COUNT(*) as count
FROM processed_transactions
GROUP BY transaction_id
HAVING COUNT(*) > 1;
```

### Simulate Credits Over Time:
```sql
-- See how credits accumulate with renewals
SELECT
  event_type,
  credits_granted,
  SUM(credits_granted) OVER (ORDER BY processed_at) as running_total,
  processed_at
FROM processed_transactions t
JOIN users u ON t.user_id = u.id
WHERE u.device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b'
ORDER BY processed_at;
```

---

## 4. Test Different Plans

### Weekly Plan Test:
```bash
curl -X POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "test_user_weekly",
      "product_id": "stylst_pro_weekly",
      "id": "weekly_001"
    }
  }'
```
**Expected:** 3 credits granted

### Monthly Plan Test:
```bash
curl -X POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "test_user_monthly",
      "product_id": "stylst_pro_monthly",
      "id": "monthly_001"
    }
  }'
```
**Expected:** 15 credits granted

### Yearly Plan Test:
```bash
curl -X POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "test_user_yearly",
      "product_id": "stylst_pro_yearly",
      "id": "yearly_001"
    }
  }'
```
**Expected:** 200 credits granted

---

## 5. Test Renewal Scenarios

### Scenario 1: User with 50 Credits Remaining Renews
```sql
-- Setup: User has 50 credits left
UPDATE users
SET redesign_credits = 50
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';

-- Trigger renewal webhook (see curl command above with RENEWAL event)
-- Expected: 50 + 200 = 250 credits
```

### Scenario 2: User with 0 Credits Renews
```sql
-- Setup: User ran out of credits
UPDATE users
SET redesign_credits = 0
WHERE device_uuid = '7a6eacd5-0e97-4195-93fa-149b245d0d6b';

-- Trigger renewal webhook
-- Expected: 0 + 200 = 200 credits
```

### Scenario 3: Multiple Renewals Over Time
```bash
# Year 1: Initial purchase
curl -X POST https://YOUR_URL/revenuecat-webhook \
  -d '{"event": {"type": "INITIAL_PURCHASE", "app_user_id": "test", "product_id": "stylst_pro_yearly", "id": "tx1"}}'

# Year 2: First renewal
curl -X POST https://YOUR_URL/revenuecat-webhook \
  -d '{"event": {"type": "RENEWAL", "app_user_id": "test", "product_id": "stylst_pro_yearly", "id": "tx2"}}'

# Year 3: Second renewal
curl -X POST https://YOUR_URL/revenuecat-webhook \
  -d '{"event": {"type": "RENEWAL", "app_user_id": "test", "product_id": "stylst_pro_yearly", "id": "tx3"}}'

# Check credits: Should have 600 credits total (200 + 200 + 200)
```

---

## 6. Test Cancellation Flow

### Test Subscription Cancellation:
```bash
curl -X POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "CANCELLATION",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "stylst_pro_yearly",
      "id": "cancel_001"
    }
  }'
```

**Expected Result:**
- `is_premium` = false
- `plan` = "free"
- Credits remain unchanged (user keeps existing credits)

### Test Reactivation:
```bash
curl -X POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "UNCANCELLATION",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "stylst_pro_yearly",
      "id": "uncancel_001"
    }
  }'
```

**Expected Result:**
- `is_premium` = true
- Gets +200 more credits (reactivation bonus)

---

## 7. Monitor Webhook Logs

### In Supabase Dashboard:
1. Go to Edge Functions → revenuecat-webhook → Logs
2. Look for these log messages:
   - ✅ `Processing RENEWAL for user...`
   - ✅ `Granting 200 credits for RENEWAL`
   - ✅ `RENEWAL user_id: credits +200 → 400 total`
   - ⚠️ `Transaction already processed, skipping`

### In RevenueCat Dashboard:
1. Go to Customers → Your test user
2. Check "Webhooks" tab
3. Verify deliveries are successful (200 status)
4. Click on individual webhooks to see payload

---

## 8. Test App Integration

### Manual App Test:
1. **Purchase subscription in app**
2. **Check app state immediately:**
   ```typescript
   // Should see in console logs:
   [DeviceAuth] Synced stats from backend: { is_premium: true, redesign_credits: 200 }
   ```
3. **Use some credits** (create redesigns)
4. **Restart app** - Credits should persist
5. **Wait for renewal** (use sandbox accelerated timing)
6. **Restart app** - Should see credits increased

### Check Local State Sync:
```typescript
// In your app, add temporary debug logging
const { redesignCredits, isPremium } = useDeviceAuth();

console.log('[DEBUG] Local state:', { redesignCredits, isPremium });

// After purchase, this should update within 5 seconds
```

---

## 9. Postman Collection for Testing

Create a Postman collection with these requests:

### Collection: RevenueCat Webhook Tests

**Request 1: Initial Purchase - Yearly**
- Method: POST
- URL: `{{SUPABASE_URL}}/functions/v1/revenuecat-webhook`
- Body: [See above]

**Request 2: Renewal - Yearly**
- Method: POST
- URL: `{{SUPABASE_URL}}/functions/v1/revenuecat-webhook`
- Body: [See above]

**Request 3: Duplicate Transaction**
- Same as Request 2 (to test deduplication)

**Request 4: Cancellation**
- Body with CANCELLATION event

**Request 5: Weekly Purchase**
- Body with weekly product_id

---

## 10. Automated Test Script

Here's a Node.js script to run all tests:

```javascript
// test-webhooks.js
const WEBHOOK_URL = 'https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook';
const TEST_USER = 'test-user-' + Date.now();

async function sendWebhook(eventType, transactionId, productId = 'stylst_pro_yearly') {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: {
        type: eventType,
        app_user_id: TEST_USER,
        product_id: productId,
        id: transactionId
      }
    })
  });
  return response.json();
}

async function runTests() {
  console.log('Test 1: Initial Purchase');
  await sendWebhook('INITIAL_PURCHASE', 'tx1');

  console.log('Test 2: First Renewal');
  await sendWebhook('RENEWAL', 'tx2');

  console.log('Test 3: Duplicate (should be rejected)');
  await sendWebhook('RENEWAL', 'tx2');

  console.log('Test 4: Second Renewal');
  await sendWebhook('RENEWAL', 'tx3');

  console.log('Tests complete! Check Supabase logs and database.');
}

runTests();
```

---

## Expected Credit Progression

| Event | Credits Before | Credits Granted | Credits After |
|-------|---------------|----------------|---------------|
| Initial Purchase | 0 | +200 | 200 |
| Used some redesigns | 200 | -50 | 150 |
| Year 1 Renewal | 150 | +200 | 350 |
| Used more redesigns | 350 | -100 | 250 |
| Year 2 Renewal | 250 | +200 | 450 |

---

## Troubleshooting

### "Credits not increasing on renewal"
- Check Supabase Edge Function logs
- Verify `processed_transactions` has the renewal entry
- Run SQL query to check user's credits
- Make sure `transactionId` is different for each renewal

### "Getting duplicate credits"
- Check if `processed_transactions` has duplicate entries
- Verify unique constraint exists on `transaction_id`
- Check webhook is not being called multiple times

### "Premium status not syncing to app"
- Call `refreshPremiumStatus()` manually
- Check backend `/user/stats` endpoint returns correct data
- Verify RevenueCat shows active subscription
- Check app console logs for sync errors

---

## Success Checklist

- [ ] Initial purchase grants 200 credits
- [ ] Renewal grants +200 more credits
- [ ] Duplicate transactions are rejected
- [ ] Credits accumulate correctly
- [ ] `processed_transactions` records all events
- [ ] App syncs premium status
- [ ] App syncs credit count
- [ ] Cancellation removes premium but keeps credits
- [ ] Different plans grant correct amounts (3, 15, 200)
