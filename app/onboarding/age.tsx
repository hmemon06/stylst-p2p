import { ProgressBar } from '@/components/ProgressBar';
import { useOnboarding } from '@/lib/onboardingContext';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ranges = [
  'Under 18',
  '18-24',
  '25-34',
  '35-44',
  '45+',
];

export default function AgeScreen() {
  const router = useRouter();
  const { updateData } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);
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
        <ProgressBar progress={20} />
        <Text style={styles.title}>What’s your age range?</Text>
        <Text style={styles.subtitle}>Select the range that applies to you.</Text>
        <View style={styles.options}>
          {ranges.map((r) => (
            <Pressable key={r} style={[styles.option, selected === r && styles.optionSelected]} onPress={() => setSelected(r)}>
              <Text style={[styles.optionText, selected === r && styles.optionTextSelected]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.cta, !selected && styles.ctaDisabled]} disabled={!selected} onPress={() => {
          updateData('age', selected);
          router.push('/onboarding/goal');
        }}>
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
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Satoshi',
    marginBottom: 24,
  },
  options: {
    gap: 12,
    marginTop: 8,
  },
  option: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  optionSelected: {
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  optionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'Satoshi',
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  ctaDisabled: {
    opacity: 0.4,
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


