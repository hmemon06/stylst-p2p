import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { usePlacement } from 'expo-superwall';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  StatusBar as RNStatusBar,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { useDeviceAuth } from '@/lib/deviceAuth';
import { resetOnboarding } from '@/lib/onboarding';

const CONTEXT_ITEMS = ['ROAST ME', 'DATE', 'OFFICE', 'GYM', 'PARTY'];

// Debug mode: only enabled when EXPO_PUBLIC_PRODUCTION is explicitly set to 'false'
const IS_DEBUG_MODE = process.env.EXPO_PUBLIC_PRODUCTION === 'false';

export default function RateScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { resetTrial, deviceUUID, isPremium, refreshPremiumStatus, redesignCredits, addRedesignCredit } = useDeviceAuth();

  // Track if user was already premium when paywall was shown (to distinguish subscription vs credit purchase)
  const wasPremiumRef = useRef(isPremium);

  // Refs to hold functions (avoids stale closure in usePlacement callback)
  const animateCreditsRef = useRef<((amount: number) => void) | null>(null);
  const addRedesignCreditRef = useRef<((amount: number) => Promise<void>) | null>(null);

  // Setup Superwall paywall
  console.log('[Superwall:Rate] usePlacement hook initializing...');
  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[Superwall:Rate] Paywall PRESENTED:', JSON.stringify(info));
      // Capture premium status when paywall opens
      wasPremiumRef.current = isPremium;
    },
    onDismiss: async (info, result) => {
      console.log('[Superwall:Rate] Paywall DISMISSED:', JSON.stringify(info), 'Result:', JSON.stringify(result));
      const paywallResult = result as any;
      const purchased =
        paywallResult?.state === 'purchased' ||
        paywallResult?.type === 'purchased' ||
        paywallResult?.purchased === true ||
        paywallResult?.transaction != null ||
        (typeof result === 'string' && (result as string).toLowerCase().includes('purchased'));

      if (purchased) {
        const wasAlreadyPremium = wasPremiumRef.current;

        if (!wasAlreadyPremium) {
          // SUBSCRIPTION purchase via Stripe Payment Sheet (trial_ended placement)
          // Brief delay to allow Stripe webhook to process before refreshing status
          await new Promise(resolve => setTimeout(resolve, 1500));
          await refreshPremiumStatus();
          router.push('/welcome-pro');
        } else {
          // CREDIT purchase via IAP / RevenueCat (on_pro_out_of_redesigns placement)
          // Sync RevenueCat immediately – no Stripe delay needed
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

          // Start animation first (sets isAnimatingCreditsRef = true to prevent sync overwrite)
          animateCreditsRef.current?.(creditAmount);

          // Then optimistically update the real credits state so canRedesign returns true immediately
          // This ensures user can use credits right away without waiting for Supabase webhook
          addRedesignCreditRef.current?.(creditAmount);
        }
      }
    },
    onError: (error) => {
      console.error('[Superwall:Rate] Paywall ERROR:', error);
    },
    onSkip: (reason: any) => {
      console.warn('[Superwall:Rate] Paywall SKIPPED. Reason:', JSON.stringify(reason));
    },
  });

  const [selectedContext, setSelectedContext] = useState('ROAST ME');
  const [isCapturing, setIsCapturing] = useState(false);

  const [userStats, setUserStats] = useState({ current_streak: 0, redesign_credits: 0, scan_count: 0, is_premium: false });

  // State for animated credit display
  const [displayedCredits, setDisplayedCredits] = useState(redesignCredits);
  const isAnimatingCreditsRef = useRef(false);

  // Fetch stats when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!deviceUUID) return;
      const { getUserStats } = require('@/lib/rater');
      getUserStats(deviceUUID).then(setUserStats);
    }, [deviceUUID])
  );
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [showDebug, setShowDebug] = useState(false);

  // Animation shared value for vignette opacity
  const vignetteOpacity = useSharedValue(1);

  const vignetteStyle = useAnimatedStyle(() => {
    return {
      opacity: vignetteOpacity.value,
    };
  });

  const creditsScale = useSharedValue(1);

  const creditsScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: creditsScale.value }],
    };
  });

  // Sync displayedCredits with actual credits when not animating
  useEffect(() => {
    if (!isAnimatingCreditsRef.current) {
      setDisplayedCredits(redesignCredits);
    }
  }, [redesignCredits]);

  // Function to animate credit increase with counting effect
  const animateCreditsIncrease = useCallback((amount: number) => {
    if (isAnimatingCreditsRef.current || amount <= 0) return;
    isAnimatingCreditsRef.current = true;

    const startValue = displayedCredits;
    const endValue = startValue + amount;
    let current = startValue;

    // Initial scale up
    creditsScale.value = withTiming(1.3, { duration: 100 });

    const interval = setInterval(() => {
      current++;
      setDisplayedCredits(current);

      // Quick pulse on each increment
      creditsScale.value = withSequence(
        withTiming(1.35, { duration: 30 }),
        withTiming(1.25, { duration: 30 })
      );

      if (current >= endValue) {
        clearInterval(interval);
        // Quick final pulse and snap back to normal
        creditsScale.value = withSequence(
          withTiming(1.4, { duration: 80 }),
          withTiming(1, { duration: 150 })
        );
        isAnimatingCreditsRef.current = false;
      }
    }, 50); // Fast 50ms per increment
  }, [displayedCredits, creditsScale]);

  // Keep the refs updated with the latest functions
  useEffect(() => {
    animateCreditsRef.current = animateCreditsIncrease;
  }, [animateCreditsIncrease]);

  useEffect(() => {
    addRedesignCreditRef.current = addRedesignCredit;
  }, [addRedesignCredit]);

  // Small pulse when credits change normally (not during animation)
  useEffect(() => {
    if (!isAnimatingCreditsRef.current) {
      creditsScale.value = withSequence(
        withTiming(1.2, { duration: 100 }),
        withSpring(1)
      );
    }
  }, [redesignCredits]);

  // Permissions check
  if (!permission) {
    // Camera permissions are still loading.
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <LinearGradient
          colors={['#000000', '#1a1a1a']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.permissionContent}>
          <View style={styles.permissionIconContainer}>
            <BlurView intensity={20} tint="light" style={styles.permissionIconBlur}>
              <SymbolView name="camera.macro" size={48} tintColor="#CCFF00" />
            </BlurView>
          </View>

          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionDescription}>
            Stylst needs access to your camera to analyze your outfits and provide personalized fashion feedback.
          </Text>

          <TouchableOpacity
            onPress={requestPermission}
            activeOpacity={0.8}
            style={styles.continueButtonContainer}
          >
            <LinearGradient
              colors={['#CCFF00', '#00FF99']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueButtonGradient}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        router.push({ pathname: '/analyzing', params: { imageUri: uri, context: selectedContext } });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePicture = async () => {
    if (cameraRef.current && !isCapturing) {
      try {
        setIsCapturing(true);

        // Trigger vignette fade out animation
        vignetteOpacity.value = withSequence(
          withTiming(0, { duration: 100 }), // Fade out quickly
          withTiming(1, { duration: 800 })  // Fade back in slowly
        );

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false, // Set to true for faster capture if needed
        });

        if (photo?.uri) {
          router.push({ pathname: '/analyzing', params: { imageUri: photo.uri, context: selectedContext } });
        }
      } catch (error) {
        console.error("Failed to take picture:", error);
        Alert.alert("Error", "Failed to capture image.");
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const toggleFlash = () => {
    setFlashMode(current => (current === 'off' ? 'on' : 'off'));
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleResetOnboarding = async () => {
    await resetOnboarding();
    setShowDebug(false);
    router.replace('/onboarding/intro');
  };

  const handleResetScans = async () => {
    await resetTrial();
    setShowDebug(false);
    Alert.alert('Success', 'Free scans reset to 0 and redesign credits reset to 1.');
  };

  const handleResetAll = async () => {
    await resetTrial();
    await resetOnboarding();
    setShowDebug(false);
    router.replace('/onboarding/intro');
  };

  const handleRestorePurchases = async () => {
    try {
      Alert.alert('Restoring...', 'Checking with App Store...');
      const { restorePurchases } = await import('@/lib/revenuecat');
      const result = await restorePurchases();
      if (result.isPremium) {
        Alert.alert('✅ Success!', 'Your premium subscription has been restored.');
      } else {
        Alert.alert('No Subscription Found', 'No active subscription found for this Apple ID.');
      }
      setShowDebug(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to restore purchases. Try again or contact support.');
    }
  };

  // Handle credit tracker press - show appropriate paywall
  const handleCreditTrackerPress = async () => {
    const placement = isPremium ? 'on_pro_out_of_redesigns' : 'trial_ended';
    console.log('[Superwall:Rate] Credit tracker pressed. isPremium:', isPremium, '| placement:', placement);
    console.log('[Superwall:Rate] registerPlacement function exists:', typeof registerPlacement === 'function');
    try {
      console.log('[Superwall:Rate] Calling registerPlacement({ placement:', placement, '})...');
      const result = await registerPlacement({ placement });
      console.log('[Superwall:Rate] registerPlacement resolved. Result:', JSON.stringify(result));
    } catch (error) {
      console.error('[Superwall:Rate] registerPlacement THREW:', error);
    }
  };

  // Handle history/closet press - show paywall for non-subscribers
  const handleHistoryPress = async () => {
    if (isPremium) {
      router.push('/history');
    } else {
      // Non-premium user - show trial ended paywall
      try {
        await registerPlacement({ placement: 'trial_ended' });
      } catch (error) {
        console.error('[Superwall] Error showing paywall:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <RNStatusBar barStyle="light-content" />

      {/* 1. The Viewfinder (The Canvas) */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flashMode}
        ref={cameraRef}
        mirror={false}
      >
        {/* The "Cinematic" Filter: Darker Vignette - Animated Wrapper */}
        <Animated.View style={[StyleSheet.absoluteFill, vignetteStyle]}>
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.25, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
        </Animated.View>

        {/* The Ghost Guide */}
        <View style={styles.ghostGuideContainer} pointerEvents="none">
          <Svg width={width * 0.8} height={height * 0.6} viewBox="0 0 200 400" style={{ opacity: 0.2 }}>
            <Path
              d="M100,60 C120,60 135,75 135,95 C135,115 120,130 100,130 C80,130 65,115 65,95 C65,75 80,60 100,60 Z 
                 M100,130 C140,140 160,160 160,200 L160,350 C160,370 150,380 130,380 L120,380 L120,250 L80,250 L80,380 L70,380 C50,380 40,370 40,350 L40,200 C40,160 60,140 100,130 Z"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
          </Svg>
        </View>
      </CameraView>

      {/* 2. The Top Bar (The Status) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        {/* Left: Streak */}
        <View style={styles.topBarLeft}>
          <TouchableOpacity onPress={handleHistoryPress}>
            <BlurView intensity={30} tint="dark" style={styles.pillIcon}>
              <SymbolView name="clock.arrow.circlepath" size={18} tintColor="#fff" />
            </BlurView>
          </TouchableOpacity>

          <View style={[styles.pill, { marginLeft: 8, backgroundColor: 'rgba(0,0,0,0.3)', overflow: 'hidden' }]}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <SymbolView name="flame.fill" size={16} tintColor="#FF5E00" />
            <Text style={styles.pillText}>{userStats.current_streak || 0}</Text>
          </View>
        </View>

        {/* Center: Logo */}
        <TouchableOpacity onLongPress={IS_DEBUG_MODE ? () => setShowDebug(true) : undefined} delayLongPress={500}>
          <Text style={styles.logoText}>STYLST</Text>
        </TouchableOpacity>

        {/* Right: Credits / Pro & Profile */}
        <View style={styles.topBarRight}>
          <TouchableOpacity onPress={handleCreditTrackerPress} style={{ marginTop: 2 }}>
            <Animated.View
              style={[
                styles.pill,
                { backgroundColor: 'rgba(0,0,0,0.3)', overflow: 'hidden' },
                creditsScaleStyle,
              ]}
            >
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={[styles.pillText, isPremium && { color: '#FFD700' }]}>
                {displayedCredits} Redesigns
              </Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/profile')}>
            <BlurView intensity={30} tint="dark" style={styles.pillIcon}>
              <SymbolView name="person.crop.circle" size={20} tintColor="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. The "Interaction Zone" (Bottom Third) */}
      <View style={[styles.interactionZone, { paddingBottom: insets.bottom + 20 }]}>

        {/* A. The Context Scroller */}
        <View style={styles.contextScrollerContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.contextScrollerContent}
          >
            {CONTEXT_ITEMS.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setSelectedContext(item)}
                style={[
                  styles.contextPill,
                  selectedContext === item && styles.contextPillSelected
                ]}
              >
                <BlurView intensity={selectedContext === item ? 0 : 40} tint="dark" style={StyleSheet.absoluteFill} />
                <Text style={[
                  styles.contextText,
                  selectedContext === item && styles.contextTextSelected
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Controls Row: Gallery - Shutter - Reverse */}
        <View style={styles.controlsRow}>

          {/* Bottom Left: Last Outfit -> Image Picker */}
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={pickImage}
          >
            {/* Placeholder for last outfit - using a generic icon if no image */}
            <BlurView intensity={40} tint="dark" style={styles.galleryButtonBlur}>
              <SymbolView name="photo.on.rectangle" size={24} tintColor="white" />
            </BlurView>
          </TouchableOpacity>

          {/* B. The Shutter Button */}
          <TouchableOpacity
            onPress={takePicture}
            disabled={isCapturing}
            activeOpacity={0.8}
            style={styles.shutterContainer}
          >
            <Svg width={80} height={80} viewBox="0 0 80 80">
              <Defs>
                <SvgLinearGradient id="shutterGlow" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#CCFF00" stopOpacity="0.8" />
                  <Stop offset="1" stopColor="#00FF99" stopOpacity="0.8" />
                </SvgLinearGradient>
              </Defs>
              {/* Outer Ring */}
              <Circle cx="40" cy="40" r="36" stroke="white" strokeWidth="4" fill="none" />
              {/* Inner Glow */}
              <Circle cx="40" cy="40" r="32" stroke="url(#shutterGlow)" strokeWidth="2" fill="none" opacity="0.6" />
              {/* Center Fill (Liquid animation placeholder - just a solid fill for now when capturing) */}
              {isCapturing && (
                <Circle cx="40" cy="40" r="30" fill="url(#shutterGlow)" />
              )}
            </Svg>
          </TouchableOpacity>

          {/* Bottom Right: Reverse Camera */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleCameraFacing}
          >
            <BlurView intensity={40} tint="dark" style={styles.controlButtonBlur}>
              <SymbolView name="arrow.triangle.2.circlepath.camera" size={24} tintColor="white" />
            </BlurView>
          </TouchableOpacity>
        </View>

      </View>

      {/* Debug Menu Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDebug}
        onRequestClose={() => setShowDebug(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDebug(false)}>
          <View style={styles.modalOverlay}>
            <BlurView intensity={80} tint="dark" style={styles.modalContent}>
              <Text style={styles.modalTitle}>Debug Menu</Text>

              <TouchableOpacity style={styles.debugButton} onPress={handleResetOnboarding}>
                <Text style={styles.debugButtonText}>Reset Onboarding</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.debugButton} onPress={handleResetScans}>
                <Text style={styles.debugButtonText}>Reset Trial (Scans + Redesigns)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.debugButton, styles.debugButtonPrimary]} onPress={handleRestorePurchases}>
                <Text style={[styles.debugButtonText, styles.debugButtonTextPrimary]}>Restore Purchases</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.debugButton, styles.debugButtonDestructive]} onPress={handleResetAll}>
                <Text style={[styles.debugButtonText, styles.debugButtonTextDestructive]}>Reset All Data</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDebug(false)}>
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  ghostGuideContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  logoText: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'BodoniModa',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  pillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  interactionZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  contextScrollerContainer: {
    marginBottom: 30,
    height: 40,
  },
  contextScrollerContent: {
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  contextPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  contextPillSelected: {
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  contextText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  contextTextSelected: {
    color: 'white',
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  shutterContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
  },
  galleryButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  controlButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: 300,
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 15,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  debugButton: {
    width: '100%',
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
  },
  debugButtonDestructive: {
    backgroundColor: 'rgba(255,59,48,0.2)',
  },
  debugButtonPrimary: {
    backgroundColor: 'rgba(52,199,89,0.2)',
  },
  debugButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  debugButtonTextDestructive: {
    color: '#FF3B30',
  },
  debugButtonTextPrimary: {
    color: '#34C759',
  },
  cancelButton: {
    marginTop: 10,
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  permissionContent: {
    width: '80%',
    alignItems: 'center',
    padding: 30,
    borderRadius: 30,
  },
  permissionIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 24,
  },
  permissionIconBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  permissionTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'BodoniModa',
  },
  permissionDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 40,
  },
  continueButtonContainer: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#CCFF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  continueButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
