# RevenueCat Integration Guide

## Overview
RevenueCat is now integrated to handle subscription management, receipt validation, and analytics. It works alongside Superwall (which handles the paywall UI).

## Setup Steps

### 1. Create RevenueCat Account
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Create a new project for your app

### 2. Configure iOS App
1. In RevenueCat Dashboard → Project Settings → Apps
2. Click "Add App" → iOS
3. Enter your **Bundle ID**: `com.anonymous.stylistai`
4. Add your **App Store Connect Shared Secret**:
   - Go to App Store Connect → Your App → App Information
   - Scroll to "App-Specific Shared Secret" → Generate/Copy
   - Paste in RevenueCat

### 3. Create Products in RevenueCat
1. Go to Products → Click "New"
2. Add your 3 subscription products:

| Identifier | App Store Product ID |
|------------|---------------------|
| `yearly` | `com.anonymous.stylistai.yearly` |
| `monthly` | `com.anonymous.stylistai.monthly` |
| `weekly` | `com.anonymous.stylistai.weekly` |

### 4. Create Entitlement
1. Go to Entitlements → Click "New"
2. **Identifier**: `premium`
3. Attach all 3 products to this entitlement

### 5. Create Offering
1. Go to Offerings → Click "New"
2. **Identifier**: `default`
3. Add packages for each product

### 6. Get API Keys
1. Go to Project Settings → API Keys
2. Copy the **iOS Public API Key** (starts with `appl_`)
3. Add to your `.env` file:
```env
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_your_key_here
```

### 7. Set Up Webhook (for Supabase sync)
1. In RevenueCat → Integrations → Webhooks
2. Click "Add Endpoint"
3. **Webhook URL**: `https://your-backend-domain.com/webhooks/revenuecat`
4. Enable events:
   - ✅ Initial Purchase
   - ✅ Renewal
   - ✅ Cancellation
   - ✅ Expiration
   - ✅ Billing Issue
   - ✅ Product Change

### 8. Connect Superwall to RevenueCat (Optional)
Superwall can use RevenueCat as its purchase controller for a seamless integration:

1. In Superwall Dashboard → Settings → Integrations
2. Enable RevenueCat integration
3. Add your RevenueCat API key

---

## Environment Variables

Add these to your root `.env` file:

```env
# RevenueCat
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_your_ios_key
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_your_android_key

# Supabase (already configured)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Superwall (already configured)
EXPO_PUBLIC_SUPERWALL_API_KEY=pk_your_key
```

---

## How It Works

### Purchase Flow
1. User exhausts 3 free scans
2. Superwall shows paywall
3. User taps "Subscribe"
4. StoreKit processes payment
5. RevenueCat validates receipt
6. RevenueCat sends webhook → Backend → Supabase updated
7. App's `CustomerInfoUpdateListener` fires → UI updates to premium

### Subscription Status
The app checks subscription status from RevenueCat:
- On app launch
- After any purchase
- Via `addCustomerInfoUpdateListener` for real-time updates

### Data Flow
```
User Purchase
     ↓
App Store / StoreKit
     ↓
RevenueCat (validates, stores)
     ↓
Webhook → Your Backend → Supabase (backup/analytics)
     ↓
CustomerInfo update → App UI
```

---

## Testing

### Sandbox Testing
1. Create a Sandbox Tester in App Store Connect
2. Sign into sandbox account on device (Settings → App Store → Sandbox)
3. Purchases will go through sandbox environment

### RevenueCat Debug Mode
The SDK is configured to log debug info in `__DEV__` mode. Check console for:
```
[RevenueCat] Configured successfully
[RevenueCat] Premium status: true com.anonymous.stylistai.yearly
```

---

## Analytics Queries

Run these in Supabase SQL Editor:

```sql
-- Daily revenue
SELECT * FROM daily_revenue LIMIT 30;

-- MRR breakdown
SELECT * FROM mrr_summary;

-- Conversion funnel
SELECT * FROM conversion_funnel;

-- Recent subscription events
SELECT * FROM subscription_events 
ORDER BY created_at DESC 
LIMIT 50;
```

---

## Troubleshooting

### Subscription not recognized after purchase
1. Check RevenueCat dashboard → Customers → search by device UUID
2. Verify entitlement is active
3. Try `restoreSubscription()` in app

### Webhook not receiving events
1. Check backend logs for `[RevenueCat Webhook]` messages
2. Verify webhook URL is correct in RevenueCat dashboard
3. Check backend is publicly accessible (not localhost)

### Products showing blank prices
1. Verify products are set up in App Store Connect
2. Check product IDs match exactly
3. Ensure products are "Ready to Submit" status

---

## Resources
- [RevenueCat Docs](https://docs.revenuecat.com)
- [React Native SDK](https://docs.revenuecat.com/docs/reactnative)
- [Webhooks Reference](https://docs.revenuecat.com/docs/webhooks)
- [Superwall + RevenueCat](https://docs.superwall.com/docs/revenuecat)

