import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePlacement } from 'expo-superwall';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ImageBackground, StatusBar, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceAuth } from '@/lib/deviceAuth';
import { loadPersistedProfile } from '@/lib/profile';
import { rateOutfit } from '@/lib/rater';
import { useRatingSession } from '@/lib/rating-session';

type AnalysisStatus = 'idle' | 'preparing' | 'requesting' | 'complete' | 'error';

const LOADING_MESSAGES = [
  "DETECTING FIT...",
  "ANALYZING COLOR THEORY...",
  "JUDGING LIFE CHOICES...",
  "CONSULTING THE FASHION POLICE...",
  "CALCULATING ROASTED LEVEL...",
  "CHECKING VIBE CHECK...",
  "SCANNING FOR DRIP...",
  "VERDICT READY."
];

export default function AnalyzingScreen() {
  const params = useLocalSearchParams<{ imageUri?: string; context?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saveSession, clearSession } = useRatingSession();
  const { canScan, isPremium, incrementScanCount, refreshPremiumStatus, scanCount, deviceUUID, addRedesignCredit } = useDeviceAuth();
  const [purchaseCompleted, setPurchaseCompleted] = useState(false);

  // Store pending result for post-purchase navigation
  const pendingResultRef = useRef<{ imageUri: string; result: any } | null>(null);

  // Track if user was already premium when paywall was shown (to distinguish subscription vs credit purchase)
  const wasPremiumRef = useRef(isPremium);

  // References to break dependency cycles
  const proceedWithRatingRef = useRef<() => void>(() => { });
  const startRatingRef = useRef<() => void>(() => { });

  // Setup Superwall paywall with callbacks
  console.log('[Superwall:Analyzing] usePlacement hook initializing...');
  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[Superwall:Analyzing] Paywall PRESENTED:', JSON.stringify(info));
      // Capture premium status when paywall opens
      wasPremiumRef.current = isPremium;
    },
    onDismiss: async (info, result) => {
      console.log('[Superwall:Analyzing] Paywall DISMISSED:', JSON.stringify(info), 'Result:', JSON.stringify(result));

      // Check if user purchased
      const paywallResult = result as any;
      const purchased =
        paywallResult?.state === 'purchased' ||
        paywallResult?.type === 'purchased' ||
        paywallResult?.purchased === true ||
        paywallResult?.transaction != null ||
        (typeof result === 'string' && (result as string).toLowerCase().includes('purchased'));

      if (purchased) {
        setPurchaseCompleted(true);

        const wasAlreadyPremium = wasPremiumRef.current;

        if (!wasAlreadyPremium) {
          // SUBSCRIPTION purchase via Stripe Payment Sheet (trial_ended placement)
          await new Promise(resolve => setTimeout(resolve, 1500));
          await refreshPremiumStatus();
          router.replace('/welcome-pro');
          return;
        } else {
          // CREDIT purchase via IAP / RevenueCat (on_pro_out_of_redesigns placement)
          try {
            const { syncPurchases } = await import('@/lib/revenuecat');
            await syncPurchases();
          } catch (e) {
            console.warn('[Superwall] Failed to sync purchases to RevenueCat:', e);
          }
          await refreshPremiumStatus();

          // Detect credit amount from product info
          const productId = paywallResult?.product?.productIdentifier
            || paywallResult?.productId
            || paywallResult?.transaction?.productIdentifier
            || '';

          // Match product ID to credit amount (3, 10, or 25)
          let creditAmount = 3; // default to smallest
          if (productId.includes('25') || productId.toLowerCase().includes('twenty')) {
            creditAmount = 25;
          } else if (productId.includes('10') || productId.toLowerCase().includes('ten')) {
            creditAmount = 10;
          } else if (productId.includes('3') || productId.toLowerCase().includes('three')) {
            creditAmount = 3;
          }

          console.log('[Superwall] Credit purchase detected, productId:', productId, 'credits:', creditAmount);

          // Optimistically update credits so user can use them immediately
          addRedesignCredit(creditAmount);
        }
      }

      router.replace('/(tabs)/rate');
    },
    onError: (error) => {
      console.error('[Superwall:Analyzing] Paywall ERROR:', error);
      Alert.alert('Trial ended', 'Your 3 free scans have been used. Upgrade to continue.');
      router.replace('/(tabs)/rate');
    },
    onSkip: (reason: any) => {
      console.warn('[Superwall:Analyzing] Paywall SKIPPED. Reason:', JSON.stringify(reason));
    },
  });

  const imageParam = Array.isArray(params.imageUri) ? params.imageUri[0] : params.imageUri;
  const imageUri = typeof imageParam === 'string' ? imageParam : undefined;
  const contextParam = Array.isArray(params.context) ? params.context[0] : params.context;
  const context = typeof contextParam === 'string' ? contextParam : undefined;

  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const startedForImageRef = useRef<string | null>(null);

  // Animations
  const loadingProgress = useSharedValue(0);

  useEffect(() => {
    // Loading bar animation - slowly progresses to 85% while loading
    // Only goes to 100% when complete
    if (status === 'complete') {
      loadingProgress.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    } else if (status === 'preparing' || status === 'requesting') {
      // Slowly progress to 85% over 4 seconds and hold
      loadingProgress.value = withTiming(0.85, { duration: 4000, easing: Easing.out(Easing.ease) });
    }
  }, [status, loadingProgress]);

  useEffect(() => {
    // Message cycling
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 800); // Rapid fire text

    return () => clearInterval(messageInterval);
  }, []);

  const animatedLoadingBarStyle = useAnimatedStyle(() => {
    return {
      width: `${loadingProgress.value * 100}%`,
    };
  });

  const proceedWithRating = useCallback(() => {
    if (!imageUri) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorMessage(null);
    setStatus('preparing');
    clearSession();

    (async () => {
      try {
        const profile = await loadPersistedProfile();
        console.log('[analyzing] Loaded profile:', profile ? JSON.stringify(profile) : 'null');
        if (controller.signal.aborted) return;

        setStatus('requesting');
        const result = await rateOutfit(imageUri, {
          profile: profile ?? undefined,
          context: context,
          signal: controller.signal,
          deviceUUID: deviceUUID ?? undefined,
        });
        if (controller.signal.aborted) return;

        saveSession({ imageUri, result });

        // Increment scan count for free users and capture the updated count.
        // IMPORTANT: Use the returned count instead of `scanCount` state to avoid stale reads.
        let updatedCount = scanCount;
        if (!isPremium) {
          try {
            updatedCount = await incrementScanCount();
          } catch (e) {
            // Best-effort fallback; don't block navigation on a local counter failure
            updatedCount = scanCount + 1;
          }
        }

        setStatus('complete');

        // CHECK PAYWALL HERE
        // If user is NOT premium AND has used up free scans (scanCount >= 3)
        // Note: scanCount was just incremented. So if they had 2, now 3. 
        // If limit is 3 free scans, then 0, 1, 2 are free. 3rd one is the last free one?
        // Usually "3 free scans" means 1, 2, 3.
        // If scanCount is now 3, they just used their 3rd scan. They should see the result.
        // If scanCount is now 4, they used their 4th scan. They should pay.

        // Let's check the current count.
        // If I just incremented to 3, that was my 3rd scan. I should see it.
        // If I just incremented to 4, that was my 4th scan. Paywall.

        // So if (scanCount > 3 && !isPremium) -> Paywall.
        // Note: I need to get the *latest* scanCount. `incrementScanCount` returns it.

        if (!isPremium) {
          // 3 free scans means counts 1,2,3 are allowed; paywall on 4+
          if (updatedCount > 3) {
            console.log('[Superwall:Analyzing] Scan limit hit. updatedCount:', updatedCount, '| Showing trial_ended paywall...');
            pendingResultRef.current = { imageUri, result };
            try {
              const paywallResult = await registerPlacement({ placement: 'trial_ended' });
              console.log('[Superwall:Analyzing] registerPlacement resolved. Result:', JSON.stringify(paywallResult));
            } catch (error) {
              console.error('[Superwall:Analyzing] registerPlacement THREW:', error);
              Alert.alert('Trial ended', 'Upgrade to see your results.');
              router.replace('/(tabs)/rate');
            }
            return;
          }
        }

        router.replace({
          pathname: '/score',
          params: {
            imageUri,
            result: JSON.stringify(result),
          },
        });
      } catch (error: any) {
        if (controller.signal.aborted) return;
        if (error?.name === 'AbortError') return;
        const message =
          typeof error?.message === 'string' && error.message.trim().length > 0
            ? error.message
            : 'Please try again.';
        setErrorMessage(message);
        setStatus('error');
        Alert.alert('Unable to rate outfit', message, [
          {
            text: 'Try again',
            onPress: () => {
              setStatus('idle');
              startRatingRef.current();
            },
          },
          {
            text: 'Back',
            style: 'cancel',
            onPress: () => {
              clearSession();
              router.replace('/(tabs)/rate');
            },
          },
        ]);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    })();
  }, [imageUri, context, clearSession, saveSession, router, isPremium, incrementScanCount, scanCount, registerPlacement]);

  const startRating = useCallback(() => {
    if (!imageUri) return;

    // REMOVED: Pre-check for canScan. We now allow analysis to run first.
    /*
    if (!canScan) {
      (async () => {
        try {
          await registerPlacement({ placement: 'trial_ended' });
        } catch (error: any) {
          console.error('[Superwall] Error showing paywall:', error);
          Alert.alert('Trial ended', 'Your 3 free scans have been used. Upgrade to continue.');
          router.replace('/(tabs)/rate');
        }
      })();
      return;
    }
    */

    proceedWithRating();
  }, [imageUri, proceedWithRating]);

  useEffect(() => {
    proceedWithRatingRef.current = proceedWithRating;
    startRatingRef.current = startRating;
  }, [proceedWithRating, startRating]);

  useEffect(() => {
    if (!imageUri) {
      router.replace('/(tabs)/rate');
      return;
    }

    // Prevent double-starts caused by dependency churn (e.g. scanCount updates).
    if (startedForImageRef.current === imageUri) {
      return;
    }
    startedForImageRef.current = imageUri;
    startRatingRef.current();

    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [imageUri, router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* 1. Immersive Background */}
      <ImageBackground source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover">
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      {/* 2. Loading Bar Animation */}
      <View style={styles.contentContainer}>
        <Animated.Text
          key={messageIndex}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.statusText}
        >
          {LOADING_MESSAGES[messageIndex]}
        </Animated.Text>
        <View style={styles.loadingBarContainer}>
          <Animated.View style={[styles.loadingBar, animatedLoadingBarStyle]}>
            <LinearGradient
              colors={['#FF0000', '#FF3333', '#FF0000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loadingGradient}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    position: 'absolute',
    top: '33%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  loadingBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    borderRadius: 2,
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5,
  },
  loadingGradient: {
    flex: 1,
    height: '100%',
  },
  statusText: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'BodoniModa',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    letterSpacing: 2,
  },
});
