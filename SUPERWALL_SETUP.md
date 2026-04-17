# Superwall Integration Guide

## 🎯 Overview
Superwall is now integrated into your app using the **Expo SDK** (`expo-superwall`)! After users use their 3 free scans, they'll see a beautiful paywall prompting them to upgrade.

## ✅ What's Already Done

The integration is complete with:
- ✅ `expo-superwall` package installed
- ✅ `SuperwallProvider` wrapping your app in `app/_layout.tsx`
- ✅ `usePlacement` hook in `app/analyzing.tsx` to show paywall when trial ends
- ✅ `.env` file ready for your API key

## 📋 Setup Checklist

### 1. Get Your Superwall API Key
1. Go to [Superwall Dashboard](https://superwall.com/dashboard)
2. Sign up or log in
3. Navigate to **Settings > API Keys**
4. Copy your **Public API Key** (starts with `pk_`)
5. Add it to `.env`:
   ```
   EXPO_PUBLIC_SUPERWALL_API_KEY=pk_your_actual_key_here
   ```

### 2. Create Your Paywall in Superwall Dashboard

#### Step 1: Create a Placement
1. In Superwall dashboard, go to **Placements**
2. Click **"New Placement"**
3. Name it: `trial_ended`
4. Description: "Shown when user runs out of free scans"
5. Click **Create**

#### Step 2: Design Your Paywall
1. Go to **Paywalls** section
2. Click **"New Paywall"**
3. Choose a template (recommended: **"Feature List"** or **"Simple"**)
4. Customize your paywall:
   - **Title**: "Unlock Unlimited Scans"
   - **Subtitle**: "Get personalized AI style ratings for all your outfits"
   - **Features**:
     - ✅ Unlimited outfit scans
     - ✅ Personalized AI feedback
     - ✅ Detailed style analysis
     - ✅ Track your style evolution
   - **CTA Button**: "Start My Premium Journey"

#### Step 3: Connect App Store Products
1. In the paywall editor, go to **Products** tab
2. Add your App Store Connect products:
   - **Monthly**: `com.yourdomain.stylstai.monthly` (e.g., $9.99/month)
   - **Yearly**: `com.yourdomain.stylstai.yearly` (e.g., $79.99/year)
3. Save the paywall

#### Step 4: Link Placement to Paywall
1. Go back to **Placements**
2. Click on your `trial_ended` placement
3. Click **"Add Rule"**
4. Set up the rule:
   - **Condition**: "Always show" (or add custom rules)
   - **Paywall**: Select the paywall you just created
   - **Targeting**: "All users" or create audience segments
5. Click **Save**

### 3. Set Up App Store Connect (Required for Real Purchases)

#### Create In-App Purchase Products
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app (create one if needed)
3. Go to **Features > In-App Purchases**
4. Click **"+"** to create a new product
5. Select **Auto-Renewable Subscription**
6. Create subscription group: "Stylst AI Premium"
7. Add subscriptions:

   **Monthly Subscription:**
   - Product ID: `com.yourdomain.stylstai.monthly`
   - Reference Name: "Stylst AI Monthly"
   - Duration: 1 month
   - Price: $9.99

   **Yearly Subscription:**
   - Product ID: `com.yourdomain.stylstai.yearly`
   - Reference Name: "Stylst AI Yearly"
   - Duration: 1 year
   - Price: $79.99

8. Add subscription information (required):
   - Display Name: "Premium Membership"
   - Description: "Get unlimited AI outfit ratings"

9. Click **Save**

### 4. Configure RevenueCat (Recommended but Optional)

Superwall works best with RevenueCat for subscription management:

1. Create a [RevenueCat account](https://www.revenuecat.com)
2. Create a new app/project
3. Add your App Store Connect API key to RevenueCat
4. In Superwall dashboard:
   - Go to **Settings > Integrations**
   - Click **RevenueCat**
   - Add your RevenueCat API key
   - This enables cross-platform subscription sync

### 5. Build Your App with EAS

Since Superwall requires native modules, you can't use Expo Go. You must build with EAS:

```bash
# Login to Expo (if not already logged in)
eas login

# Configure your build (if not done already)
eas build:configure

# Build for iOS (recommended for Superwall testing)
eas build --profile development --platform ios

# Or build for Android
eas build --profile development --platform android
```

**For Testing on Physical Device:**

After the build completes, you'll get a download link. Install the app on your device, then:

```bash
# Start the development server
npx expo start --dev-client

# Scan the QR code with your installed development build
```

**Alternative: Local Development Build (iOS only):**

```bash
# Install development client dependency
npx expo install expo-dev-client

# Run locally (requires Xcode)
npx expo run:ios

# This will build and install on iOS simulator or connected device
```

## 🔧 How It Works in Your App

### Code Flow

1. **App Initialization** (`app/_layout.tsx`):
   ```typescript
   import { SuperwallProvider } from 'expo-superwall';
   
   // Superwall wraps your entire app
   <SuperwallProvider apiKeys={{ ios: SUPERWALL_API_KEY }}>
     {/* Your app content */}
   </SuperwallProvider>
   ```

2. **Paywall Hook Setup** (`app/analyzing.tsx`):
   ```typescript
   import { usePlacement } from 'expo-superwall';
   
   // Setup callbacks for paywall events
   const { registerPlacement } = usePlacement({
     onPresent: (info) => {
       console.log('[Superwall] Paywall presented:', info);
     },
     onDismiss: (info, result) => {
       // User closed paywall - navigate back
       router.replace('/(tabs)/rate');
     },
     onError: (error) => {
       // Handle errors
       Alert.alert('Trial ended', 'Upgrade to continue.');
     },
   });
   ```

3. **Trial Check**:
   ```typescript
   // When user tries to scan after using 3 free scans:
   if (!canScan) {
     // Shows Superwall paywall with placement "trial_ended"
     await registerPlacement({ placement: 'trial_ended' });
   }
   ```

4. **Paywall Display**:
   - Superwall automatically shows the paywall you designed
   - User can purchase subscription
   - If they purchase, Superwall handles the transaction
   - When they close the paywall, `onDismiss` callback fires

5. **Subscription Validation**:
   - Superwall automatically tracks subscription status
   - Next time they try to scan, if they're subscribed, the paywall won't show
   - They get unlimited scans

## 🎨 Customization Options

### Update Paywall Design
1. Go to Superwall dashboard > Paywalls
2. Click your paywall
3. Edit visual design:
   - Colors to match your app (#57AB92 green theme)
   - Fonts (Satoshi to match your app)
   - Images/icons
   - Button styles

### Add Multiple Paywalls
Create different paywalls for:
- `onboarding_completed` - Show after onboarding
- `trial_ended` - After 3 free scans (current)
- `feature_upsell` - When they tap premium features

### A/B Testing
1. In Superwall, create multiple paywall variants
2. Set up experiments
3. Superwall automatically tracks conversion rates

## 🧪 Testing

### Test Mode
1. In Superwall dashboard, enable **Test Mode**
2. This lets you test paywalls without real purchases
3. Use test Apple IDs for sandbox purchases

### Sandbox Testing
1. Create a Sandbox Tester in App Store Connect
2. Sign out of your Apple ID on device
3. When making a purchase, use the sandbox credentials
4. Purchases won't charge real money

## 📊 Analytics

Superwall automatically tracks:
- Paywall views
- Conversion rate
- Revenue
- Churn rate

View in: **Superwall Dashboard > Analytics**

## 🚀 Going Live

Before launch:
1. ✅ Test subscriptions in sandbox mode
2. ✅ Complete App Store Review information
3. ✅ Set up taxes in App Store Connect
4. ✅ Disable Test Mode in Superwall
5. ✅ Build production version: `eas build --profile production --platform ios`

## 🔐 Security Notes

- ✅ API key is public (client-side) - this is expected
- ✅ Subscription validation happens server-side via Apple
- ✅ RevenueCat adds extra security layer (recommended)
- ⚠️ Never expose private/secret keys in client code

## 📞 Support

- [Superwall Docs](https://docs.superwall.com)
- [Superwall Discord](https://discord.gg/superwall)
- [RevenueCat Docs](https://www.revenuecat.com/docs)

## 🎯 Quick Start Commands

```bash
# 1. Add your API key to .env
# EXPO_PUBLIC_SUPERWALL_API_KEY=pk_your_key

# 2. Build development version
eas build --profile development --platform ios

# 3. Install and run
npx expo start --dev-client

# 4. Test the flow:
#    - Complete onboarding
#    - Scan 3 outfits
#    - On 4th scan attempt, paywall shows!
```

---

**That's it!** Your paywall is now ready to convert free users into premium subscribers. 🎉
