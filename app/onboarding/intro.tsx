import { ResizeMode, Video } from 'expo-av';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Video Background */}
      <Video
        source={require('../../assets/videos/intro-video.mp4')}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        pointerEvents="none"
      />

      {/* Dark overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Logo/Title at top */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>stylst</Text>
        </View>

        {/* Bottom CTA */}
        <View style={[styles.bottomCta, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.tagline}>AI-powered style ratings</Text>

          <Pressable
            style={styles.cta}
            onPress={() => router.push('/onboarding/calibration')}
            accessibilityRole="button"
          >
            <BlurView intensity={40} tint="dark" style={styles.ctaBlur} pointerEvents="none">
              <View style={styles.ctaInner}>
                <Text style={styles.ctaText}>Get Started</Text>
              </View>
            </BlurView>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 56,
    fontFamily: 'BodoniModa',
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  bottomCta: {
    paddingHorizontal: 24,
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'Satoshi',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  cta: {
    width: '100%',
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
