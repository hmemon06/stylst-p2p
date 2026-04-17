# ✅ Superwall Integration - Correct Implementation

## Package Used
✅ **`expo-superwall`** (Expo-compatible SDK)
❌ ~~`@superwall/react-native-superwall`~~ (Legacy React Native SDK - removed)

## Key Code Changes

### 1. `app/_layout.tsx` - Provider Setup

```typescript
import { SuperwallProvider } from 'expo-superwall';
import Constants from 'expo-constants';

const SUPERWALL_API_KEY = 
  Constants.expoConfig?.extra?.superwallApiKey || 
  process.env.EXPO_PUBLIC_SUPERWALL_API_KEY || '';

export default function RootLayout() {
  // ... fonts setup ...
  
  return (
    <SuperwallProvider apiKeys={{ ios: SUPERWALL_API_KEY }}>
      {/* Rest of your providers and app content */}
    </SuperwallProvider>
  );
}
```

**What Changed:**
- ❌ ~~`Superwall.configure(apiKey)`~~ (old SDK)
- ✅ `<SuperwallProvider apiKeys={{ ios: apiKey }}>` (new SDK)

---

### 2. `app/analyzing.tsx` - Paywall Trigger

```typescript
import { usePlacement } from 'expo-superwall';

export default function AnalyzingScreen() {
  const router = useRouter();
  
  // Setup paywall callbacks
  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[Superwall] Paywall presented:', info);
    },
    onDismiss: (info, result) => {
      console.log('[Superwall] Paywall dismissed');
      router.replace('/(tabs)/rate');
    },
    onError: (error) => {
      console.error('[Superwall] Error:', error);
      Alert.alert('Trial ended', 'Upgrade to continue.');
      router.replace('/(tabs)/rate');
    },
  });
  
  // When trial ends, show paywall
  const startRating = useCallback(() => {
    if (!canScan) {
      (async () => {
        try {
          await registerPlacement({ placement: 'trial_ended' });
        } catch (error) {
          // Error handled by onError callback
        }
      })();
      return;
    }
    // Continue with rating...
  }, [canScan, registerPlacement]);
}
```

**What Changed:**
- ❌ ~~`Superwall.shared.register({ placement: 'trial_ended' })`~~ (old SDK)
- ✅ `usePlacement` hook with callbacks (new SDK)
- ✅ `registerPlacement({ placement: 'trial_ended' })` (new API)

---

## API Differences Comparison

| Feature | Old SDK (`@superwall/react-native-superwall`) | New SDK (`expo-superwall`) |
|---------|----------------------------------------------|---------------------------|
| **Import** | `import Superwall from '@superwall/react-native-superwall'` | `import { SuperwallProvider, usePlacement } from 'expo-superwall'` |
| **Configuration** | `Superwall.configure(apiKey)` | `<SuperwallProvider apiKeys={{ ios: apiKey }}>` |
| **Show Paywall** | `Superwall.shared.register({ placement: 'name' })` | `registerPlacement({ placement: 'name' })` |
| **Callbacks** | Promise-based | Hook-based with `onPresent`, `onDismiss`, `onError` |
| **Compatibility** | Bare React Native | Expo managed workflow ✅ |

---

## Environment Setup

**`.env` file:**
```bash
EXPO_PUBLIC_RATER_URL=http://172.20.10.4:3000/rate
EXPO_PUBLIC_SUPERWALL_API_KEY=pk_your_superwall_api_key_here
```

Get your API key from: [Superwall Dashboard → Settings → API Keys](https://superwall.com/dashboard)

---

## Building the App

Since Superwall requires native modules:

```bash
# Cannot use Expo Go! Must build with EAS:
eas build --profile development --platform ios

# After build completes, install on device and run:
npx expo start --dev-client
```

---

## Testing the Flow

1. ✅ Complete onboarding
2. ✅ Scan 3 outfits (free trial)
3. ✅ On 4th scan attempt → Superwall paywall appears!
4. ✅ User can purchase or dismiss
5. ✅ If purchased → Unlimited scans

---

## Dashboard Setup

In your Superwall dashboard:

1. **Create Placement:**
   - Name: `trial_ended`
   - This exact name matches `registerPlacement({ placement: 'trial_ended' })`

2. **Create Paywall:**
   - Design your paywall UI
   - Add App Store product IDs
   - Link to your `trial_ended` placement

3. **Test:**
   - Enable Test Mode in dashboard
   - Use sandbox App Store credentials

---

## Why This Matters

✅ **expo-superwall** is:
- Built for Expo's managed workflow
- Works with EAS Build
- Simpler API with React hooks
- Better TypeScript support
- Maintained by Superwall team for Expo

❌ **@superwall/react-native-superwall** was:
- Built for bare React Native
- Requires manual native configuration
- Not optimized for Expo
- More complex imperative API

---

## Resources

- [expo-superwall Docs](https://docs.superwall.com/docs/expo)
- [Superwall Dashboard](https://superwall.com/dashboard)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)

---

**You're all set!** 🎉 The correct Expo SDK is now integrated and ready to show paywalls.
