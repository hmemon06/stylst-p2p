import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SuperwallProvider, useSuperwallEvents } from 'expo-superwall';
import Superwall from 'expo-superwall/compat';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { DeviceAuthProvider, useDeviceAuth } from '@/lib/deviceAuth';
import { OnboardingProvider } from '@/lib/onboardingContext';
import { RatingSessionProvider } from '@/lib/rating-session';

// Get Superwall API key from environment
const SUPERWALL_API_KEY = Constants.expoConfig?.extra?.superwallApiKey || process.env.EXPO_PUBLIC_SUPERWALL_API_KEY || '';
console.log('[Superwall:Init] API key source:', Constants.expoConfig?.extra?.superwallApiKey ? 'app.json extra' : process.env.EXPO_PUBLIC_SUPERWALL_API_KEY ? '.env' : 'NONE');
console.log('[Superwall:Init] API key present:', !!SUPERWALL_API_KEY, SUPERWALL_API_KEY ? `(${SUPERWALL_API_KEY.substring(0, 8)}...)` : '(empty)');

/**
 * Handles Superwall deep link redemption after Stripe Payment Sheet.
 *
 * Flow:
 * 1. Universal link arrives (e.g. https://stylst.superwall.app/redeem/...)
 * 2. We pass it to Superwall via handleDeepLink so the SDK can redeem the purchase
 * 3. SDK fires willRedeemLink -> network call to validate -> fires didRedeemLink
 * 4. didRedeemLink refreshes premium status and navigates to welcome-pro
 *
 * We do NOT navigate in the URL handler — didRedeemLink owns all navigation
 * so there's no race condition or screen flash.
 */
function SuperwallRedemptionHandler() {
  const router = useRouter();
  const { refreshPremiumStatus } = useDeviceAuth();

  // Listen for Superwall redemption lifecycle events
  useSuperwallEvents({
    willRedeemLink: () => {
      console.log('[Superwall] Redemption started (willRedeemLink)');
    },
    didRedeemLink: async (result) => {
      const status = (result as any).status ?? (result as any).type ?? 'unknown';
      console.log('[Superwall] Redemption completed (didRedeemLink):', status);

      if (status === 'SUCCESS' || status === 'success') {
        await refreshPremiumStatus();
        console.log('[Superwall] Premium status refreshed after successful redemption');
        router.replace('/welcome-pro');
      } else {
        console.warn('[Superwall] Redemption issue:', status);
        router.replace('/(tabs)/rate');
      }
    },
  });

  // Pass Superwall universal links to the SDK for redemption.
  // Do NOT navigate here — let didRedeemLink handle all navigation.
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      if (event.url.includes('superwall.app') || event.url.includes('superwall.me')) {
        console.log('[Layout] Superwall URL, passing to SDK for redemption:', event.url);
        Superwall.shared.handleDeepLink(event.url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: if app was opened via Superwall universal link
    Linking.getInitialURL().then((url) => {
      if (url && (url.includes('superwall.app') || url.includes('superwall.me'))) {
        console.log('[Layout] Cold start Superwall URL, passing to SDK:', url);
        Superwall.shared.handleDeepLink(url);
      }
    });

    return () => subscription.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Satoshi: require('../assets/fonts/Satoshi-Variable.ttf'),
    BodoniModa: require('../assets/fonts/Bodoni_Moda/BodoniModa-VariableFont_opsz,wght.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SuperwallProvider
      apiKeys={{ ios: SUPERWALL_API_KEY }}
      onConfigurationError={(error) => {
        console.error('[Superwall:Init] Configuration FAILED:', error);
        console.error('[Superwall:Init] API key was:', SUPERWALL_API_KEY ? `${SUPERWALL_API_KEY.substring(0, 8)}...` : 'EMPTY');
      }}
    >
      <OnboardingProvider>
        <RatingSessionProvider>
          <DeviceAuthProvider>
            <SuperwallRedemptionHandler />
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="onboarding/intro" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/calibration" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/identify" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/age" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/goal" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/spectrum" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/visual-taste" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/color-profile" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/fit-profile" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/calibrating" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/grant" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/preferences" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/motivation" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="analyzing" options={{ headerShown: false }} />
                <Stack.Screen name="score" options={{ headerShown: false }} />
                <Stack.Screen name="history" options={{ headerShown: false }} />
                <Stack.Screen name="paywall" options={{ headerShown: false }} />
                <Stack.Screen name="welcome-pro" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="profile" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </DeviceAuthProvider>
        </RatingSessionProvider>
      </OnboardingProvider>
    </SuperwallProvider>
  );
}
