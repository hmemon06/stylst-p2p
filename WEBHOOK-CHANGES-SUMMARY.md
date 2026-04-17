# Webhook Changes Summary - One-Time Credit Support

## What Changed

Your webhook now supports **both subscriptions AND one-time credit purchases**.

---

## Code Changes

### 1. Added Credit Product Mapping (Lines 22-29)

```typescript
// One-time credit purchase products
// Map product IDs to credit amounts
const ONE_TIME_CREDITS: Record<string, number> = {
  redesign_credits_5: 5,
  redesign_credits_15: 15,
  redesign_credits_50: 50,
  redesign_credits_200: 200,
};
```

**What it does:** Maps product IDs to credit amounts for one-time purchases.

---

### 2. Updated `determineCredits()` Function (Lines 31-68)

**Before:**
```typescript
function determineCredits(productId: string): number {
  // Only handled subscriptions
  if (productId.includes("yearly")) return 200;
  if (productId.includes("monthly")) return 15;
  if (productId.includes("weekly")) return 3;
  return 200;
}
```

**After:**
```typescript
function determineCredits(productId: string, eventType: string): number {
  // For NON_RENEWING_PURCHASE, check one-time credit products first
  if (eventType === "NON_RENEWING_PURCHASE") {
    // Check exact match with ONE_TIME_CREDITS map
    for (const [key, credits] of Object.entries(ONE_TIME_CREDITS)) {
      if (lowerProduct.includes(key) || lowerProduct === key) {
        return credits;
      }
    }

    // Extract number from product ID (e.g., "stylst_50_credits" → 50)
    const numberMatch = lowerProduct.match(/(\d+)/);
    if (numberMatch) {
      const number = parseInt(numberMatch[1], 10);
      if (number >= 1 && number <= 500) return number;
    }
  }

  // For subscriptions (same as before)
  if (productId.includes("yearly")) return 200;
  if (productId.includes("monthly")) return 15;
  if (productId.includes("weekly")) return 3;
  return 200;
}
```

**What changed:**
- Now takes `eventType` as second parameter
- For `NON_RENEWING_PURCHASE`, checks one-time credit products first
- Falls back to number extraction if no exact match
- Subscriptions work exactly as before

---

### 3. Don't Set Premium Status for One-Time Purchases (Lines 168-177)

**Before:**
```typescript
const updateData: any = {
  is_premium: true,        // ❌ Always set premium
  plan: plan,              // ❌ Always set plan
  redesign_credits: newCredits,
  last_credited_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

**After:**
```typescript
const updateData: any = {
  redesign_credits: newCredits,
  last_credited_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Only update premium status and plan for subscriptions (not one-time purchases)
if (!isOneTimePurchase) {
  updateData.is_premium = true;
  updateData.plan = plan;

  if (isInitialPurchase && !existingUser.subscription_started_at) {
    updateData.subscription_started_at = new Date().toISOString();
  }
}
```

**What changed:**
- One-time purchases: Grant credits only (no premium, no plan change)
- Subscriptions: Grant credits + set premium + set plan (same as before)

---

### 4. Better Logging (Lines 205-206, 247-248)

**Before:**
```typescript
console.log(`✅ NEW SUBSCRIBER ${appUserId}: credits +${creditsToGrant} → ${newCredits} total, plan=${plan}`);
```

**After:**
```typescript
const eventLabel = isOneTimePurchase ? 'CREDIT PURCHASE' : (isInitialPurchase ? 'NEW SUBSCRIBER' : 'RENEWAL');
console.log(`✅ ${eventLabel} ${appUserId}: credits +${creditsToGrant} → ${newCredits} total${!isOneTimePurchase ? `, plan=${plan}` : ''}`);
```

**Example logs:**
- Subscription: `✅ NEW SUBSCRIBER user-123: credits +200 → 200 total, plan=yearly`
- Credit purchase: `✅ CREDIT PURCHASE user-123: credits +50 → 250 total`

---

## Behavior Comparison

### Subscription Purchase (INITIAL_PURCHASE)
```json
{
  "event": {
    "type": "INITIAL_PURCHASE",
    "product_id": "stylst_pro_yearly"
  }
}
```

**Result:**
- ✅ Grants 200 credits
- ✅ Sets `is_premium = true`
- ✅ Sets `plan = "yearly"`
- ✅ Sets `subscription_started_at`
- ✅ Records transaction

---

### Subscription Renewal (RENEWAL)
```json
{
  "event": {
    "type": "RENEWAL",
    "product_id": "stylst_pro_yearly"
  }
}
```

**Result:**
- ✅ Grants +200 MORE credits (accumulates)
- ✅ Keeps `is_premium = true`
- ✅ Keeps `plan = "yearly"`
- ✅ Updates `last_credited_at`
- ✅ Records transaction

---

### One-Time Credit Purchase (NON_RENEWING_PURCHASE) ⭐ NEW
```json
{
  "event": {
    "type": "NON_RENEWING_PURCHASE",
    "product_id": "redesign_credits_50"
  }
}
```

**Result:**
- ✅ Grants +50 credits
- ❌ Does NOT set `is_premium`
- ❌ Does NOT change `plan`
- ✅ Updates `last_credited_at`
- ✅ Records transaction

---

## Testing Commands

### Test Credit Purchase (50 credits)
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "7a6eacd5-0e97-4195-93fa-149b245d0d6b",
      "product_id": "redesign_credits_50",
      "id": "test_credit_001"
    }
  }'
```

**Expected:**
- Your credits: 200 → 250
- `is_premium`: still `true` (from your yearly subscription)
- `plan`: still `"yearly"`

---

### Test Credit Purchase for Free User
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "NON_RENEWING_PURCHASE",
      "app_user_id": "free-user-123",
      "product_id": "redesign_credits_15",
      "id": "test_credit_002"
    }
  }'
```

**Expected:**
- User gets 15 credits
- `is_premium`: stays `false`
- `plan`: stays `null` or `"free"`
- They can use redesigns without being premium

---

## What You Need to Do Next

1. **Create Products in App Store Connect**
   - Product IDs: `redesign_credits_5`, `redesign_credits_15`, `redesign_credits_50`, `redesign_credits_200`
   - Type: Non-Consumable
   - Prices: $2.99, $6.99, $14.99, $29.99

2. **Add to RevenueCat**
   - Add each product to RevenueCat dashboard
   - Ensure product IDs match exactly

3. **Configure Superwall Paywall**
   - Go to your `on_pro_out_of_redesigns` placement
   - Add the credit products to the paywall
   - Design how they're displayed (recommended: show all 4 options)

4. **Deploy Updated Webhook**
   ```bash
   supabase functions deploy revenuecat-webhook
   ```

5. **Test**
   - Use curl commands above
   - Check Supabase logs
   - Verify credits in database

---

## Files Modified

- ✅ [supabase-webhook-revenuecat.ts](supabase-webhook-revenuecat.ts) - Updated webhook logic

## Files Created

- 📄 [ONE-TIME-CREDITS-SETUP.md](ONE-TIME-CREDITS-SETUP.md) - Full setup guide
- 📄 [WEBHOOK-CHANGES-SUMMARY.md](WEBHOOK-CHANGES-SUMMARY.md) - This file

---

## Summary

Your webhook now intelligently handles:
- **Subscriptions** → Grant credits + premium status
- **Renewals** → Grant more credits + maintain premium
- **One-time purchases** → Grant credits ONLY (no premium)

All events are idempotent (duplicate-proof) and logged to `processed_transactions`.

🎉 You're ready to offer flexible credit purchasing!
