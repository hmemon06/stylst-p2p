import { ProgressBar } from '@/components/ProgressBar';
import { Slider } from '@/components/Slider';
import { useOnboarding } from '@/lib/onboardingContext';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SpectrumScreen() {
  const router = useRouter();
  const { updateData } = useOnboarding();
  const [value, setValue] = useState(0.5); // Default to middle
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

        <ProgressBar progress={30} />

        <Text style={styles.title}>What's your priority: Comfort or Style?</Text>

        <View style={styles.sliderContainer}>
          <Slider
            value={value}
            onValueChange={setValue}
            leftLabel="100% Comfort"
            rightLabel="100% Style"
          />
        </View>

        <View style={styles.valueDisplay}>
          <Text style={styles.valueText}>
            {Math.round(value * 100)}% Comfort / {Math.round((1 - value) * 100)}% Style
          </Text>
        </View>

        <Pressable
          style={styles.cta}
          onPress={() => {
            updateData('comfortStyleBalance', value);
            router.push('/onboarding/visual-taste');
          }}
        >
          <BlurView intensity={40} tint="dark" style={styles.ctaBlur} pointerEvents="none">
            <View style={styles.ctaInner}>
              <Text style={styles.ctaText}>Continue</Text>
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
    marginBottom: 40,
    textAlign: 'center',
  },
  sliderContainer: {
    marginVertical: 40,
  },
  valueDisplay: {
    alignItems: 'center',
    marginBottom: 40,
  },
  valueText: {
    fontSize: 18,
    fontFamily: 'Satoshi',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  cta: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 'auto',
    marginBottom: 32,
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
