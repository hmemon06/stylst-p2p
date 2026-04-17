import { ProgressBar } from '@/components/ProgressBar';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CalibrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backLink, { top: insets.top + 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>{'← Back'}</Text>
        </Pressable>

        <ProgressBar progress={10} />

        <Text style={styles.title}>First, let's find your style.</Text>
        <Text style={styles.subtitle}>This 2-minute quiz builds your personal 'Style DNA.' This allows your AI to give advice that is 100% tailored to you.</Text>

        <Pressable style={styles.cta} onPress={() => router.push('/onboarding/identify')} accessibilityRole="button">
          <BlurView intensity={40} tint="dark" style={styles.ctaBlur} pointerEvents="none">
            <View style={styles.ctaInner}>
              <Text style={styles.ctaText}>Start Calibration</Text>
            </View>
          </BlurView>
        </Pressable>
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
    paddingHorizontal: 24,
    paddingTop: 80,
    justifyContent: 'center',
  },
  backLink: {
    position: 'absolute',
    left: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    zIndex: 10,
  },
  backText: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Satoshi',
    fontSize: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'BodoniModa',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Satoshi',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
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
  },
});
