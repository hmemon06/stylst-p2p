import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    FadeInDown,
    FadeOut,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';

export default function GrantScreen() {
  const router = useRouter();
  const [isOpened, setIsOpened] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animation values
  const giftScale = useSharedValue(1);
  const giftRotation = useSharedValue(0);
  const giftTranslateY = useSharedValue(0);
  const giftOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Initial appearance of the gift box
    giftScale.value = withSpring(1, { damping: 12 });

    // 2. Start bouncing
    giftTranslateY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const handleOpenGift = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Stop bouncing
    giftTranslateY.value = withTiming(0, { duration: 200 });

    // 1. Start shaking
    giftRotation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withRepeat(
        withSequence(
          withTiming(10, { duration: 100 }),
          withTiming(-10, { duration: 100 })
        ),
        10, // Shake 10 times
        true
      ),
      withTiming(0, { duration: 50 })
    );

    // Trigger haptics during shake
    const interval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 100);

    // 2. Explode and Open
    setTimeout(() => {
      clearInterval(interval);

      // Explode
      giftScale.value = withTiming(3, { duration: 500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
      giftOpacity.value = withTiming(0, { duration: 300 });

      // Reveal content
      contentOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));

      triggerSuccessHaptics();
      setIsOpened(true);
    }, 1500);
  };

  const triggerSuccessHaptics = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const animatedGiftStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: giftScale.value },
        { rotate: `${giftRotation.value}deg` },
        { translateY: giftTranslateY.value }
      ],
      opacity: giftOpacity.value,
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [
        { scale: interpolate(contentOpacity.value, [0, 1], [0.9, 1]) }
      ]
    };
  });

  return (
    <View style={styles.container}>
      {/* Gift Box Animation Layer */}
      {!isOpened && (
        <View style={styles.giftLayer}>
          <Animated.View style={[styles.giftContainer, animatedGiftStyle]}>
            <Ionicons name="gift" size={120} color="white" />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(300)}
            exiting={FadeOut}
            style={styles.preOpenContent}
          >
            <Text style={styles.preOpenTitle}>We have a gift for you</Text>
            <Text style={styles.preOpenSubtitle}>Thanks for calibrating your style profile.</Text>

            <Pressable
              style={styles.openButton}
              onPress={handleOpenGift}
              disabled={isAnimating}
            >
              <BlurView intensity={40} tint="dark" style={styles.ctaBlur} pointerEvents="none">
                <View style={styles.ctaInner}>
                  <Text style={styles.ctaText}>{isAnimating ? "Opening..." : "Open My Gift"}</Text>
                </View>
              </BlurView>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Main Content Layer */}
      {isOpened && (
        <Animated.View style={[styles.content, animatedContentStyle]}>
          <View style={styles.successContainer}>
            <Animated.Text
              entering={FadeInDown.delay(400).springify()}
              style={styles.title}
            >
              You're In!
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(600).springify()}
              style={styles.subtitle}
            >
              Here's a gift to get you started
            </Animated.Text>

            <View style={styles.giftsContainer}>
              <Animated.View
                entering={FadeInDown.delay(800).springify()}
                style={styles.giftCard}
              >
                <BlurView intensity={30} tint="dark" style={styles.giftCardBlur}>
                  <View style={styles.giftCardInner}>
                    <Text style={styles.giftNumber}>3</Text>
                    <Text style={styles.giftLabel}>Free Outfit Scans</Text>
                    <Text style={styles.giftDescription}>Get AI-powered style ratings for your outfits</Text>
                  </View>
                </BlurView>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(1000).springify()}
                style={styles.giftCard}
              >
                <BlurView intensity={30} tint="dark" style={styles.giftCardBlur}>
                  <View style={styles.giftCardInner}>
                    <Text style={styles.giftNumber}>1</Text>
                    <Text style={styles.giftLabel}>Free AI Redesign</Text>
                    <Text style={styles.giftDescription}>See your outfit's full potential with AI styling</Text>
                  </View>
                </BlurView>
              </Animated.View>
            </View>
          </View>

          <Animated.View entering={FadeInDown.delay(1400).springify()} style={styles.ctaContainer}>
            <Pressable
              style={styles.cta}
              onPress={() => router.replace('/(tabs)/rate')}
            >
              <BlurView intensity={40} tint="dark" style={styles.ctaBlur} pointerEvents="none">
                <View style={styles.ctaInner}>
                  <Text style={styles.ctaText}>Claim My Gift</Text>
                </View>
              </BlurView>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 24,
  },
  giftContainer: {
    marginBottom: 40,
  },
  preOpenContent: {
    alignItems: 'center',
    width: '100%',
  },
  preOpenTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'BodoniModa',
    marginBottom: 12,
    textAlign: 'center',
  },
  preOpenSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'Satoshi',
    textAlign: 'center',
    marginBottom: 40,
  },
  openButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 60,
    justifyContent: 'center',
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'BodoniModa',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Satoshi',
    textAlign: 'center',
    marginBottom: 40,
  },
  giftsContainer: {
    width: '100%',
    gap: 16,
  },
  giftCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  giftCardBlur: {
    width: '100%',
  },
  giftCardInner: {
    padding: 24,
    alignItems: 'center',
  },
  giftNumber: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    fontFamily: 'BodoniModa',
    marginBottom: 4,
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  giftLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Satoshi',
    marginBottom: 8,
  },
  giftDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: 'Satoshi',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaContainer: {
    marginTop: 'auto',
    marginBottom: 32,
    width: '100%',
  },
  cta: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaBlur: {
    flex: 1,
  },
  ctaInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ctaText: {
    color: '#FFFFFF',
    fontFamily: 'Satoshi',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
