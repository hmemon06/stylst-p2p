
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { usePlacement } from 'expo-superwall';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Stop, LinearGradient as SvgLinearGradient, Text as SvgText } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';

import { useDeviceAuth } from '@/lib/deviceAuth';
import { loadPersistedProfile } from '@/lib/profile';
import { RatingResult, createMockRating, normalizeRatingResult, rateOutfit, saveRedesignRating } from '@/lib/rater';
import { useRatingSession } from '@/lib/rating-session';

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getStatEmoji(key: string, score: number): string {
  if (key === 'aura') return score > 80 ? '✨' : score > 50 ? '😐' : '💀';
  if (key === 'fit') return score > 80 ? '📐' : score > 50 ? '👕' : '🥴';
  if (key === 'palette') return score > 80 ? '🎨' : score > 50 ? '🎭' : '🤢';
  if (key === 'trend') return score > 80 ? '🔥' : score > 50 ? '📉' : '🗿';
  return '⚡';
}

function getStatColor(score: number): string {
  return score > 80 ? '#34C759' : score > 50 ? '#FFCC00' : '#FF3B30';
}

export default function ScoreScreen() {
  const params = useLocalSearchParams<{ imageUri?: string; result?: string; promptSignIn?: string; redesignImageUri?: string }>();
  const router = useRouter();
  const {
    currentCard,
    stack,
    currentIndex,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    pushCard,
    clearStack
  } = useRatingSession();

  // ... (auth hooks)

  const {
    canScan,
    canRedesign,
    redesignCredits,
    incrementScanCount,
    isPremium,
    deviceUUID,
    refreshPremiumStatus,
    addRedesignCredit
  } = useDeviceAuth();
  const { width, height } = useWindowDimensions();

  // Track if user was already premium when paywall was shown (to distinguish subscription vs credit purchase)
  const wasPremiumRef = useRef(isPremium);

  // Setup Superwall paywall
  console.log('[Superwall:Score] usePlacement hook initializing...');
  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[Superwall:Score] Paywall PRESENTED:', JSON.stringify(info));
      // Capture premium status when paywall opens
      wasPremiumRef.current = isPremium;
    },
    onDismiss: async (info, result) => {
      console.log('[Superwall:Score] Paywall DISMISSED:', JSON.stringify(info), 'Result:', JSON.stringify(result));
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
          await new Promise(resolve => setTimeout(resolve, 1500));
          await refreshPremiumStatus();
          router.push('/welcome-pro');
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
    },
    onError: (error) => {
      console.error('[Superwall:Score] Paywall ERROR:', error);
    },
    onSkip: (reason: any) => {
      console.warn('[Superwall:Score] Paywall SKIPPED. Reason:', JSON.stringify(reason));
    },
  });
  const insets = useSafeAreaInsets();

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const openFullScreen = (uri: string | null | undefined) => {
    if (uri) setFullScreenImage(uri);
  };

  const closeFullScreen = () => {
    setFullScreenImage(null);
  };


  // ... (debug effect)
  useEffect(() => {
    console.log('[ScoreScreen] Stack state:', {
      stackLength: stack.length,
      currentIndex,
      canGoBack,
      canGoForward,
      currentCardId: currentCard?.id,
      isRedesign: currentCard?.isRedesign,
    });
  }, [stack.length, currentIndex, canGoBack, canGoForward, currentCard]);

  const routeImageParam = Array.isArray(params.imageUri) ? params.imageUri[0] : params.imageUri;
  const resultParam = Array.isArray(params.result) ? params.result[0] : params.result;
  const promptSignIn = Array.isArray(params.promptSignIn) ? params.promptSignIn[0] : params.promptSignIn;

  // Get image and rating from current card or route params
  const baseImageUri = currentCard?.imageUri ?? (typeof routeImageParam === 'string' ? routeImageParam : undefined);
  const isRedesign = currentCard?.isRedesign ?? false;

  // Find if this card has any redesign children, and get the most recent one
  const redesignChild = useMemo(() => {
    if (!currentCard) return null;
    const redesigns = stack.filter(c => c.isRedesign && c.parentId === currentCard.id);
    return redesigns.length > 0 ? redesigns[redesigns.length - 1] : null;
  }, [currentCard, stack]);

  // Current image for THIS card (original or redesign)
  const imageUri = baseImageUri;
  // If this card already has a completed glow-up in the stack, show it as the preview.
  const glowUpImageUri = redesignChild?.imageUri ?? null;

  useEffect(() => {
    if (promptSignIn === 'true') {
      setTimeout(() => {
        Alert.alert(
          'Link Account',
          'Would you like to link your account to save your subscription across devices?',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Sign In / Link',
              onPress: () => router.push('/auth/sign-in')
            }
          ]
        );
      }, 1000);
    }
  }, [promptSignIn, router]);

  const rating = useMemo<RatingResult>(() => {
    if (currentCard?.result) {
      return currentCard.result;
    }
    const fallback = createMockRating();
    if (!resultParam) {
      return fallback;
    }
    const attempts = [resultParam, decodeParam(resultParam)];
    for (const candidate of attempts) {
      try {
        const parsed = JSON.parse(candidate);
        return normalizeRatingResult(parsed);
      } catch {
        continue;
      }
    }
    return fallback;
  }, [currentCard, resultParam]);

  // Calculate scores
  const score = rating.overall.score;
  const potentialScore = rating.potential_score ?? Math.min(100, score + 20);
  const redesignPrompt = rating.redesign_prompt;
  const hideCritique = !redesignPrompt || score >= potentialScore;

  // Determine theme color based on score
  const themeColor = score < 50 ? '#FF3B30' : score < 75 ? '#FFCC00' : '#34C759';

  // Animation for the unlock button
  const pulse = useSharedValue(1);

  // Stamp Animation Values
  const stampScale = useSharedValue(2.5);
  const stampOpacity = useSharedValue(0);

  useEffect(() => {
    // Reset animations when card changes
    stampScale.value = 2.5;
    stampOpacity.value = 0;

    // Button pulse
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );

    // Stamp Animation: Slam down (no bounce)
    stampScale.value = withDelay(100, withTiming(1, { duration: 200, easing: Easing.out(Easing.poly(4)) }));
    stampOpacity.value = withDelay(100, withTiming(1, { duration: 100 }));

  }, [currentIndex, pulse, stampScale, stampOpacity]);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
    };
  });

  const animatedStampStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: stampScale.value }, { rotate: '-8deg' }],
      opacity: stampOpacity.value,
    };
  });

  // Share functionality
  const viewShotRef = useRef<ViewShot>(null);
  const shareCardRef = useRef<ViewShot>(null);

  const handleShare = async () => {
    try {
      if (!shareCardRef.current?.capture) {
        Alert.alert('Error', 'Unable to capture screen');
        return;
      }

      const uri = await shareCardRef.current.capture();

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your style score',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share. Please try again.');
    }
  };

  const handleUnlock = useCallback(async () => {
    console.log('[Superwall:Score] handleUnlock called. redesignPrompt:', !!redesignPrompt, '| canRedesign:', canRedesign, '| isPremium:', isPremium);

    // Check if we have a redesign prompt
    if (!redesignPrompt) {
      console.log('[Superwall:Score] No redesign prompt — bailing out');
      Alert.alert('No Redesign Available', 'There is no redesign suggestion for this outfit.');
      return;
    }

    // Check redesign credits
    if (!canRedesign) {
      const placement = isPremium ? 'on_pro_out_of_redesigns' : 'trial_ended';
      console.log('[Superwall:Score] No credits — showing paywall. placement:', placement);
      // Show appropriate paywall based on subscription status
      try {
        console.log('[Superwall:Score] Calling registerPlacement({ placement:', placement, '})...');
        const result = await registerPlacement({ placement });
        console.log('[Superwall:Score] registerPlacement resolved. Result:', JSON.stringify(result));
      } catch (error) {
        console.error('[Superwall:Score] registerPlacement THREW:', error);
        Alert.alert(
          'No Redesign Credits',
          'You need redesign credits to see your glow-up. Please try again later.'
        );
      }
      return;
    }

    console.log('[Superwall:Score] User has credits, proceeding with redesign...');

    setIsUnlocking(true);

    try {
      // Start the redesign job (async)
      // Note: Backend will handle credit deduction
      console.log('[ScoreScreen] Starting async redesign job...');
      const { createRedesignJob, pollRedesignStatus, getUserStats } = require('@/lib/rater');

      const outfitId = rating.outfit_id;
      if (!outfitId) {
        throw new Error('This outfit cannot be redesigned (missing ID). Please take a new photo.');
      }

      const job = await createRedesignJob(outfitId, redesignPrompt, { deviceUUID });

      console.log('[ScoreScreen] Job started:', job.id);

      // Sync credits from backend after job creation (backend deducted the credit)
      if (deviceUUID) {
        const stats = await getUserStats(deviceUUID);
        // Update local state to match backend without calling the spend function
        // This is handled by DeviceAuth's periodic sync, but we do it immediately for UI responsiveness
        console.log('[ScoreScreen] Synced credits from backend:', stats.redesign_credits);
      }

      // Poll for completion (giving it a good 45s of active polling before letting user just wait)
      const maxPolls = 15; // 15 * 3s = 45s
      let redesignUrl = null;

      for (let i = 0; i < maxPolls; i++) {
        // Wait 3s
        await new Promise(r => setTimeout(r, 3000));

        const status = await pollRedesignStatus(job.id, { deviceUUID });
        console.log(`[ScoreScreen] Poll ${i + 1}/${maxPolls}:`, status.status);

        if (status.status === 'completed' && status.redesign_image_url) {
          redesignUrl = status.redesign_image_url;
          break;
        }
        if (status.status === 'failed') {
          throw new Error('Generation failed on server.');
        }
      }

      if (!redesignUrl) {
        // Timed out (on client side) but server is still working
        Alert.alert(
          'Still Working!',
          'This is taking a bit longer than usual. You can wait here, or check your "History" later to see the result!',
          [
            { text: 'Wait Here', style: 'cancel' }, // User can just keep waiting (UI will stay unlocking?) - actually we should probably stop unlocking state
            { text: 'Go to History', onPress: () => router.push('/history') }
          ]
        );
        setIsUnlocking(false); // Stop the spinner so they can leave
        return;
      }

      console.log('[ScoreScreen] Generated image:', redesignUrl);

      // Rate the newly generated image
      const profile = await loadPersistedProfile();
      const redesignResult = await rateOutfit(redesignUrl, { profile });

      // Increment scan count (rating the redesign uses a scan)
      await incrementScanCount();

      // Push the new redesign card with the generated image
      pushCard({
        imageUri: redesignUrl, // Use the Seedream-generated image
        result: redesignResult,
        isRedesign: true,
        parentId: currentCard?.id,
      });

      // Best-effort: persist the glow-up rating onto the ORIGINAL outfit record so
      // "Your Closet" can show accurate pro/critique for the redesigned look.
      try {
        await saveRedesignRating(String(outfitId), redesignResult, redesignUrl, { deviceUUID });
      } catch (persistError) {
        console.warn('[ScoreScreen] Failed to persist redesign rating:', persistError);
      }

      console.log('[ScoreScreen] Redesign complete! New score:', redesignResult.overall.score);

    } catch (error: any) {
      console.error('[ScoreScreen] Unlock error:', error);

      // Note: Backend automatically refunds credits on job failure
      // We should sync credits from backend to reflect the refund
      if (deviceUUID) {
        try {
          const { getUserStats } = require('@/lib/rater');
          const stats = await getUserStats(deviceUUID);
          console.log('[ScoreScreen] Synced credits after error:', stats.redesign_credits);
        } catch (syncError) {
          console.warn('[ScoreScreen] Failed to sync credits after error:', syncError);
        }
      }

      Alert.alert('Generation Failed', error.message || 'Failed to generate your glow-up. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  }, [
    redesignPrompt,
    canRedesign,
    incrementScanCount,
    pushCard,
    currentCard,
    router,
    isPremium,
    registerPlacement,
    deviceUUID,
    rating.outfit_id
  ]);

  const handleRetake = () => {
    clearStack();
    router.replace('/(tabs)/rate');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Full Screen Image Modal */}
      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade" onRequestClose={closeFullScreen}>
        <View style={styles.fullScreenContainer}>
          <Pressable style={styles.fullScreenBackdrop} onPress={closeFullScreen} />
          <Image
            source={{ uri: fullScreenImage || '' }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
          <Pressable style={styles.closeButton} onPress={closeFullScreen} hitSlop={20}>
            <SymbolView name="xmark.circle.fill" size={30} tintColor="#fff" />
          </Pressable>
        </View>
      </Modal>

      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={StyleSheet.absoluteFill}>
        {/* Top Section Background (Dark Vignette) */}
        <View style={[StyleSheet.absoluteFill, { height: '60%' }]}>
          <ImageBackground
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)', '#000000']}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
        </View>

        {/* Navigation Header - Only show arrows when there's something to navigate to */}
        {(canGoBack || canGoForward) ? (
          <View style={[styles.navigationHeader, { top: insets.top + 10 }]}>
            {/* Back Arrow - positioned left */}
            {canGoBack && (
              <Pressable
                onPress={goBack}
                style={[styles.navButton, styles.navButtonLeft]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <BlurView intensity={30} tint="dark" style={styles.navButtonBlur}>
                  <SymbolView name="chevron.left" size={20} tintColor="white" />
                </BlurView>
              </Pressable>
            )}

            {/* Stack Position Indicator - always centered */}
            <BlurView intensity={20} tint="dark" style={styles.stackIndicator}>
              <Text style={styles.stackIndicatorText}>{currentIndex + 1}/{stack.length}</Text>
            </BlurView>

            {/* Forward Arrow - positioned right */}
            {canGoForward && (
              <Pressable
                onPress={goForward}
                style={[styles.navButton, styles.navButtonRight]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <BlurView intensity={30} tint="dark" style={styles.navButtonBlur}>
                  <SymbolView name="chevron.right" size={20} tintColor="white" />
                </BlurView>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Share Button */}
        <Pressable
          onPress={handleShare}
          style={[styles.shareButton, { top: insets.top + 60 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BlurView intensity={30} tint="dark" style={styles.shareButtonBlur}>
            <SymbolView name="square.and.arrow.up" size={20} tintColor="white" />
          </BlurView>
        </Pressable>

        <View style={styles.mainContent} key={currentCard?.id || 'initial'}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: height * 0.45 }]}
            showsVerticalScrollIndicator={false}
          >

            {/* ZONE 1: THE VERDICT */}
            <View style={styles.verdictZone}>
              <View style={styles.headerRow}>
                {/* Score Stamp - Animated */}
                <Animated.View style={[styles.stampContainer, animatedStampStyle]}>
                  <Svg height="90" width="110" viewBox="0 0 100 80">
                    <Defs>
                      <SvgLinearGradient id="stampGradient" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={themeColor} stopOpacity="1" />
                        <Stop offset="1" stopColor={themeColor} stopOpacity="0.8" />
                      </SvgLinearGradient>
                    </Defs>
                    <Path
                      d="M5,5 L95,5 L95,75 L5,75 Z"
                      fill="none"
                      stroke="url(#stampGradient)"
                      strokeWidth="3"
                      strokeDasharray="4,2"
                    />
                    <SvgText
                      x="50"
                      y="58"
                      fill={themeColor}
                      fontSize="52"
                      fontWeight="bold"
                      fontFamily="BodoniModa"
                      textAnchor="middle"
                      stroke={themeColor}
                      strokeWidth="1.5"
                    >
                      {score}
                    </SvgText>
                  </Svg>
                </Animated.View>

                {/* Potential Pill - Staggered Entry */}
                <Animated.View entering={FadeInDown.delay(1500).springify()}>
                  <BlurView intensity={20} tint="dark" style={styles.potentialPill}>
                    <Text style={styles.potentialLabel}>POTENTIAL</Text>
                    <Text style={styles.potentialValue}>{potentialScore} 🚀</Text>
                  </BlurView>
                </Animated.View>
              </View>

              {/* Headline - Staggered Entry */}
              <Animated.Text
                entering={FadeInDown.delay(1700).springify()}
                style={styles.headline}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {rating.overall.label.toUpperCase()}
              </Animated.Text>

              {/* Stats Grid - Staggered Entry */}
              <Animated.View entering={FadeInDown.delay(1900).springify()} style={styles.statsGrid}>
                {rating.subscores.map((sub) => (
                  <View key={sub.key} style={styles.statItem}>
                    <Text style={styles.statLabel}>{sub.label.toUpperCase()}</Text>
                    <View style={styles.statValueRow}>
                      <Text style={[styles.statNumber, { color: getStatColor(sub.score) }]}>{sub.score}</Text>
                      <Text style={styles.statEmoji}>{getStatEmoji(sub.key, sub.score)}</Text>
                    </View>
                  </View>
                ))}
              </Animated.View>
            </View>

            {/* ZONE 2: THE DIAGNOSIS - Staggered Entry */}
            <Animated.View entering={FadeInDown.delay(2100).springify()} style={styles.diagnosisZone}>
              <BlurView intensity={15} tint="dark" style={styles.diagnosisCard}>
                <View style={styles.diagnosisItem}>
                  <SymbolView name="checkmark.circle.fill" size={18} tintColor="#34C759" style={styles.icon} />
                  <Text style={styles.diagnosisBody} numberOfLines={3}>{rating.compliment}</Text>
                </View>
                {!hideCritique ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.diagnosisItem}>
                      <SymbolView name="xmark.circle.fill" size={18} tintColor="#FF3B30" style={styles.icon} />
                      <Text style={styles.diagnosisBody} numberOfLines={3}>{rating.critique}</Text>
                    </View>
                  </>
                ) : null}
              </BlurView>
            </Animated.View>

          </ScrollView>
        </View>

        {/* ZONE 3: THE FIX (Floating Bottom Card) - Staggered Entry */}
        <Animated.View entering={FadeInDown.delay(2300).springify()} style={[styles.fixZone, { height: height * 0.345, bottom: insets.bottom + 20 }]}>
          <View style={styles.splitPreview}>
            {/* Left: Current (Dark Vignette) */}
            <Pressable style={styles.splitHalf} onPress={() => openFullScreen(imageUri)}>
              <ImageBackground source={{ uri: imageUri }} style={styles.splitImage} resizeMode="cover">
                <LinearGradient
                  colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)']}
                  style={StyleSheet.absoluteFill}
                />
              </ImageBackground>
              <View style={styles.splitLabelContainer}>
                <Text style={styles.splitLabel}>CURRENT</Text>
              </View>
            </Pressable>

            {/* Right: Glow Up (Pixelated/Blurry until generated) */}
            <Pressable
              style={styles.splitHalf}
              onPress={() => glowUpImageUri ? openFullScreen(glowUpImageUri) : undefined}
              disabled={!glowUpImageUri}
            >
              {glowUpImageUri ? (
                <ImageBackground source={{ uri: glowUpImageUri }} style={styles.splitImage} resizeMode="cover" />
              ) : redesignPrompt ? (
                <>
                  <Image source={{ uri: imageUri }} style={styles.splitImage} blurRadius={20} resizeMode="cover" />
                  <View style={styles.lockOverlay}>
                    <SymbolView name="lock.fill" size={28} tintColor="white" />
                  </View>
                </>
              ) : (
                <LinearGradient
                  colors={['#1a1a2e', '#0f3460']}
                  style={[styles.splitImage, { justifyContent: 'center', alignItems: 'center' }]}
                >
                  <SymbolView name="checkmark.seal.fill" size={32} tintColor="#34C759" />
                </LinearGradient>
              )}
              <View style={styles.splitLabelContainer}>
                <Text style={styles.splitLabel}>GLOW UP</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.bottomControls}>
            {redesignPrompt ? (
              <>
                <Animated.View style={[styles.unlockButtonContainer, animatedButtonStyle]}>
                  {glowUpImageUri ? (
                    <Pressable
                      onPress={canGoForward ? goForward : undefined}
                      style={[styles.unlockButton, !canGoForward && styles.unlockButtonDisabled]}
                      disabled={!canGoForward}
                    >
                      <LinearGradient colors={['#FFFFFF', '#E0E0E0']} style={styles.unlockGradient}>
                        <Text style={styles.unlockText}>VIEW GLOW UP</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleUnlock}
                      style={[styles.unlockButton, isUnlocking && styles.unlockButtonDisabled]}
                      disabled={isUnlocking}
                    >
                      <LinearGradient
                        colors={isUnlocking ? ['#888', '#666'] : ['#FFFFFF', '#E0E0E0']}
                        style={styles.unlockGradient}
                      >
                        {isUnlocking ? (
                          <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color="#000" />
                            <Text style={styles.unlockText}>  Creating your glow-up...</Text>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.unlockText}>SEE YOUR GLOW UP</Text>
                            <Text style={styles.creditText}>
                              {isPremium ? '(Premium)' : `(${redesignCredits} credit${redesignCredits !== 1 ? 's' : ''} left)`}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </Pressable>
                  )}
                </Animated.View>
              </>
            ) : (
              <View style={styles.maxedOutContainer}>
                <Text style={styles.maxedOutText}>🎉 You’ve reached max potential!</Text>
              </View>
            )}

            <Pressable onPress={handleRetake} style={styles.retakeButton}>
              <Text style={styles.retakeText}>Take another</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ViewShot>

      {/* Hidden Share Card — rendered off-screen, captured on share */}
      <View style={styles.shareCardWrapper} pointerEvents="none">
        <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.shareCard}>
            {/* Background Image */}
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111' }]} />
            )}

            {/* Top vignette */}
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'transparent']}
              style={[StyleSheet.absoluteFill, { height: '35%' }]}
            />

            {/* Bottom vignette */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
              locations={[0, 0.4, 1]}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' }}
            />

            {/* STYLST branding */}
            <View style={styles.shareCardBranding}>
              <Text style={styles.shareCardBrandText}>STYLST</Text>
            </View>

            {/* Score stamp — top-left, tilted */}
            <View style={styles.shareCardStamp}>
              <Svg height="90" width="110" viewBox="0 0 100 80">
                <Defs>
                  <SvgLinearGradient id="shareStampGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={themeColor} stopOpacity="1" />
                    <Stop offset="1" stopColor={themeColor} stopOpacity="0.8" />
                  </SvgLinearGradient>
                </Defs>
                <Path
                  d="M5,5 L95,5 L95,75 L5,75 Z"
                  fill="none"
                  stroke="url(#shareStampGrad)"
                  strokeWidth="3"
                  strokeDasharray="4,2"
                />
                <SvgText
                  x="50"
                  y="58"
                  fill={themeColor}
                  fontSize="52"
                  fontWeight="bold"
                  fontFamily="BodoniModa"
                  textAnchor="middle"
                  stroke={themeColor}
                  strokeWidth="1.5"
                >
                  {score}
                </SvgText>
              </Svg>
            </View>

            {/* Bottom content */}
            <View style={styles.shareCardBottom}>
              {/* Potential pill */}
              <View style={styles.shareCardPotentialPill}>
                <Text style={styles.shareCardPotentialLabel}>POTENTIAL</Text>
                <Text style={styles.shareCardPotentialValue}>{potentialScore} 🚀</Text>
              </View>

              {/* Vibe label */}
              <Text style={styles.shareCardVibe} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {rating.overall.label.toUpperCase()}
              </Text>

              {/* Stats grid */}
              <View style={styles.shareCardStats}>
                {rating.subscores.map((sub) => (
                  <View key={sub.key} style={styles.shareCardStatItem}>
                    <Text style={styles.shareCardStatLabel}>{sub.label.toUpperCase()}</Text>
                    <View style={styles.shareCardStatValueRow}>
                      <Text style={[styles.shareCardStatNumber, { color: getStatColor(sub.score) }]}>{sub.score}</Text>
                      <Text style={styles.shareCardStatEmoji}>{getStatEmoji(sub.key, sub.score)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ViewShot>
      </View>
    </View>
  );
}

const SHARE_CARD_W = 390;
const SHARE_CARD_H = 693;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  navigationHeader: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  navButton: {
    position: 'absolute',
    width: 44,
    height: 44,
  },
  navButtonLeft: {
    left: 0,
  },
  navButtonRight: {
    right: 0,
  },
  navButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  stackIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  stackIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Satoshi',
    fontWeight: '700',
  },
  shareButton: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
  },
  shareButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  verdictZone: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  stampContainer: {
    marginTop: 5,
  },
  potentialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  potentialLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontFamily: 'Satoshi',
    fontWeight: '700',
  },
  potentialValue: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Satoshi',
    fontWeight: '900',
  },
  headline: {
    color: 'white',
    fontSize: 42,
    fontFamily: 'BodoniModa',
    fontWeight: '700',
    lineHeight: 52,
    marginBottom: 0,
    paddingTop: 0,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statItem: {
    width: '48%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: 'Satoshi',
    fontWeight: '700',
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Satoshi',
    fontWeight: '900',
  },
  statEmoji: {
    fontSize: 18,
  },
  diagnosisZone: {
    marginBottom: 20,
  },
  diagnosisCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  diagnosisItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  icon: {
    marginTop: 2,
  },
  diagnosisBody: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontFamily: 'Satoshi',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  fixZone: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#000',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  splitPreview: {
    flex: 1,
    flexDirection: 'row',
  },
  splitHalf: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  splitImage: {
    width: '100%',
    height: '100%',
  },
  splitLabelContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  splitLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontFamily: 'Satoshi',
    fontWeight: '900',
    letterSpacing: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  unlockButtonContainer: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  unlockButton: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  unlockButtonDisabled: {
    opacity: 0.8,
  },
  unlockGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockText: {
    color: 'black',
    fontSize: 14,
    fontFamily: 'Satoshi',
    fontWeight: '900',
  },
  creditText: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 10,
    fontFamily: 'Satoshi',
    marginTop: 2,
    fontWeight: '600',
  },
  maxedOutContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  maxedOutText: {
    color: '#34C759',
    fontSize: 14,
    fontFamily: 'Satoshi',
    fontWeight: '700',
  },
  retakeButton: {
    paddingVertical: 8,
    marginTop: 4,
  },
  retakeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'Satoshi',
    fontWeight: '600',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 30,
    zIndex: 999,
  },

  /* ── Share Card (hidden, captured for sharing) ── */
  shareCardWrapper: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },
  shareCard: {
    width: SHARE_CARD_W,
    height: SHARE_CARD_H,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  shareCardBranding: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  shareCardBrandText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'BodoniModa',
  },
  shareCardStamp: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 3,
    transform: [{ rotate: '-12deg' }],
  },
  shareCardBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    zIndex: 3,
    alignItems: 'center',
    gap: 8,
  },
  shareCardPotentialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  shareCardPotentialLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontFamily: 'Satoshi',
    fontWeight: '700',
    letterSpacing: 1,
  },
  shareCardPotentialValue: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Satoshi',
    fontWeight: '900',
  },
  shareCardVibe: {
    color: 'white',
    fontSize: 36,
    fontFamily: 'BodoniModa',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  shareCardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  shareCardStatItem: {
    width: '47%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareCardStatLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: 'Satoshi',
    fontWeight: '700',
    letterSpacing: 1,
  },
  shareCardStatValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareCardStatNumber: {
    fontSize: 18,
    fontFamily: 'Satoshi',
    fontWeight: '900',
  },
  shareCardStatEmoji: {
    fontSize: 16,
  },
});
