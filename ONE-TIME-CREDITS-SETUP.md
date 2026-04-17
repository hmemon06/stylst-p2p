# One-Time Credit Purchase Setup Guide

## Overview

This guide shows you how to set up one-time redesign credit purchases that work alongside your subscription system. Users can buy credits without subscribing, and the webhook will automatically grant them the credits.

---

## What You Need to Do

### 1. Create Products in App Store Connect

Go to [App Store Connect](https://appstoreconnect.apple.com) and create **Non-Consumable** in-app purchases:

#### Recommended Credit Packages:

| Package | Credits | Price | Product ID |
|---------|---------|-------|------------|
| Small | 5 credits | $2.99 | `com.stylst.redesign_credits_5` |
| Medium | 15 credits | $6.99 | `com.stylst.redesign_credits_15` |
| Large | 50 credits | $14.99 | `com.stylst.redesign_credits_50` |
| Mega | 200 credits | $29.99 | `com.stylst.redesign_credits_200` |

**Steps:**
1. In App Store Connect, go to your app
2. Click **Features** → **In-App Purchases**
3. Click **+** to create new product
4. Select **Non-Consumable** (important!)
5. Fill in details:
   - **Product ID**: `com.stylst.redesign_credits_5` (or your bundle ID)
   - **Reference Name**: "5 Redesign Credits"
   - **Price**: $2.99
6. Add localized descriptions
7. Repeat for other packages

---

### 2. Add Products to RevenueCat

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Navigate to your project → **Products**
3. Click **Add Product**
4. For each package:
   - **Product ID**: Must match App Store Connect (e.g., `redesign_credits_5`)
   - **Type**: Non-Consumable
   - **Platform**: iOS
5. Save each product

---

### 3. Configure Superwall Paywall

Since you're using Superwall for your `on_pro_out_of_redesigns` placement, you need to add these products to your paywall:

#### Option A: Use Existing Paywall
1. Go to [Superwall Dashboard](https://superwall.com/dashboard)
2. Navigate to **Paywalls**
3. Find the paywall linked to `on_pro_out_of_redesigns`
4. Click **Products** tab
5. Add your credit products:
   - `redesign_credits_5` → 5 Credits
   - `redesign_credits_15` → 15 Credits
   - `redesign_credits_50` → 50 Credits
   - `redesign_credits_200` → 200 Credits

#### Option B: Create New Paywall for Credits
1. Create a new paywall in Superwall
2. Choose template: **"Multiple Options"** or **"Feature List"**
3. Customize:
   - **Title**: "Get More Redesigns"
   - **Subtitle**: "Choose the package that fits your style journey"
   - **Features**: Show credit amounts and pricing
4. Add products (same as above)
5. Link to `on_pro_out_of_redesigns` placement

---

### 4. Update Your Webhook (Already Done! ✅)

The webhook code in `supabase-webhook-revenuecat.ts` has been updated to handle one-time purchases:

**What it does:**
- Detects `NON_RENEWING_PURCHASE` events
- Extracts credit amount from product ID (e.g., `redesign_credits_50` → 50 credits)
- Grants credits WITHOUT setting `is_premium = true`
- Records transaction to prevent duplicates
- Logs: `✅ CREDIT PURCHASE user_id: credits +50 → 105 total`

**Supported Product ID Formats:**
1. Exact match: `redesign_credits_5`, `redesign_credits_15`, etc.
2. Contains keyword: `stylst_redesign_credits_50`, `com.stylst.redesign_credits_200`
3. Number extraction: Any product with a number (e.g., `my_app_50_credits` → 50)

---

### 5. Deploy Updated Webhook

Deploy the updated webhook to Supabase:

```bash
# Navigate to your Supabase project directory
cd supabase/functions/revenuecat-webhook

# Copy the updated webhook code
cp ../../../supabase-webhook-revenuecat.ts index.ts

# Deploy
supabase functions deploy revenuecat-webhook
```

---

## How It Works

### Flow for One-Time Credit Purchase:

```
User runs out of redesigns
    ↓
App shows Superwall paywall (placement: on_pro_out_of_redesigns)
    ↓
User selects "50 Credits for $14.99"
    ↓
Apple processes payment
    ↓
RevenueCat receives purchase → Sends webhook: NON_RENEWING_PURCHASE
    ↓
Your webhook:
  - Checks transaction_id (prevents duplicates)
  - Extracts credits from product_id: "redesign_credits_50" → 50
  - Grants +50 credits (doesn't change is_premium or plan)
  - Records transaction
    ↓
User has 50 more credits, still NOT premium (unless they already subscribed)
```

### Difference from Subscriptions:

| Event Type | Sets Premium | Sets Plan | Grants Credits | Recurring |
|------------|--------------|-----------|----------------|-----------|
| INITIAL_PURCHASE (subscription) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| RENEWAL (subscription) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| NON_RENEWING_PURCHASE (credits) | ❌ No | ❌ No | ✅ Yes | ❌ No |

**Key Point:** One-time credit purchases just add credits. They don't grant premium status or change the user's plan.

---

## Testing

### Test with Manual Webhook Call

Simulate a credit purchase by sending a webhook to your Supabase function:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "test-user-123",
      "product_id": "redesign_credits_50",
      "id": "test_tx_001"
    }
  }'
```

**Expected Result:**
- User gets +50 credits
- `is_premium` stays false (unless already subscribed)
- `plan` stays null or current value
- Transaction recorded in `processed_transactions`
- Log: `✅ CREDIT PURCHASE test-user-123: credits +50 → 50 total`

### Test Different Packages

```bash
# Test 5 credits
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "test-user-123",
      "product_id": "redesign_credits_5",
      "id": "test_tx_002"
    }
  }'

# Test 15 credits
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "test-user-123",
      "product_id": "redesign_credits_15",
      "id": "test_tx_003"
    }
  }'
```

### Verify in Database

```sql
-- Check user credits (should accumulate)
SELECT
  device_uuid,
  is_premium,
  plan,
  redesign_credits,
  last_credited_at
FROM users
WHERE device_uuid = 'test-user-123';

-- Check transactions
SELECT
  transaction_id,
  event_type,
  product_id,
  credits_granted,
  processed_at
FROM processed_transactions t
JOIN users u ON t.user_id = u.id
WHERE u.device_uuid = 'test-user-123'
ORDER BY processed_at DESC;
```

---

## Customizing Credit Amounts

If you want different credit amounts, update the `ONE_TIME_CREDITS` map in the webhook:

```typescript
// In supabase-webhook-revenuecat.ts (lines 24-29)
const ONE_TIME_CREDITS: Record<string, number> = {
  redesign_credits_5: 5,     // Change to 10 for $2.99 = 10 credits
  redesign_credits_15: 15,   // Change to 20 for $6.99 = 20 credits
  redesign_credits_50: 50,   // Change to 60 for $14.99 = 60 credits
  redesign_credits_200: 200, // Change to 250 for $29.99 = 250 credits
};
```

Then redeploy the webhook.

---

## Pricing Strategy

### Recommended Pricing (based on value per redesign):

Assuming each redesign costs you ~$0.20 in API costs:

| Package | Credits | Cost to You | Price | Profit | Per Credit |
|---------|---------|-------------|-------|--------|------------|
| Small | 5 | $1.00 | $2.99 | $1.99 | $0.60 |
| Medium | 15 | $3.00 | $6.99 | $3.99 | $0.47 |
| Large | 50 | $10.00 | $14.99 | $4.99 | $0.30 |
| Mega | 200 | $40.00 | $29.99 | -$10.01 ❌ | $0.15 |

**Suggested Adjustments:**
- **5 credits**: $2.99 ✅ (good entry point)
- **15 credits**: $7.99 (increase slightly)
- **50 credits**: $19.99 (better margin)
- **200 credits**: $49.99 or remove (push to yearly subscription instead)

### Alternative: Anchor Pricing

Make yearly subscription the best value:

| Option | Credits | Price | Per Credit | Best Value? |
|--------|---------|-------|------------|-------------|
| 5 Credits | 5 | $2.99 | $0.60 | ❌ |
| 15 Credits | 15 | $8.99 | $0.60 | ❌ |
| 50 Credits | 50 | $24.99 | $0.50 | ❌ |
| **Yearly Sub** | **200/year** | **$49.99/year** | **$0.25** | ✅ Best! |

This nudges users toward subscriptions while offering flexibility.

---

## Monitoring

### Check Recent Credit Purchases

```sql
SELECT
  u.device_uuid,
  t.event_type,
  t.product_id,
  t.credits_granted,
  u.redesign_credits as total_credits_now,
  t.processed_at
FROM processed_transactions t
JOIN users u ON t.user_id = u.id
WHERE t.event_type = 'NON_RENEWING_PURCHASE'
ORDER BY t.processed_at DESC
LIMIT 20;
```

### Revenue Tracking

Track revenue in RevenueCat Dashboard → Charts → Filter by product type.

---

## FAQ

### Q: Do credit purchases give premium status?
**A:** No. Only subscriptions grant `is_premium = true`. One-time purchases just add credits.

### Q: Can users buy credits AND subscribe?
**A:** Yes! Credits stack. If they subscribe (200 credits/year) and buy 50 credits, they'll have 250 total.

### Q: What happens if they already used some credits?
**A:** New credits add to their current balance. If they have 10 left and buy 50, they'll have 60.

### Q: Are these purchases recurring?
**A:** No. Non-consumable purchases are one-time only. If they run out, they buy more.

### Q: Should I use consumable or non-consumable?
**A:** Use **Non-Consumable** so they can restore purchases if they reinstall the app.

---

## Next Steps

1. ✅ Webhook updated (already done)
2. ⬜ Create products in App Store Connect
3. ⬜ Add products to RevenueCat
4. ⬜ Configure Superwall paywall with credit options
5. ⬜ Deploy updated webhook to Supabase
6. ⬜ Test with sandbox purchases
7. ⬜ Monitor logs and database

---

## Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Check RevenueCat webhook delivery status
3. Verify product IDs match exactly
4. Test with curl commands first

Good luck! 🚀
