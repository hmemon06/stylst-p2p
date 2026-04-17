import { markOnboardingCompleted } from '@/lib/onboarding';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const motivations = [
  'Improve my style',
  'Try new styles',
  'Get personalized ratings',
  'Find outfit ideas',
];

export default function MotivationScreen() {
  const router = useRouter();
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  const toggle = (value: string) => {
    if (selectedReasons.includes(value)) {
      setSelectedReasons(selectedReasons.filter((v) => v !== value));
    } else {
      setSelectedReasons([...selectedReasons, value]);
    }
  };

  const canContinue = selectedReasons.length > 0;

  const handleFinish = async () => {
    await markOnboardingCompleted();
    router.push('/(tabs)/rate');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backLink, { top: insets.top + 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>{'← Back'}</Text>
        </Pressable>
        <View style={styles.progressWrap}>
          <View style={styles.progressBg} />
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.title}>What brings you here?</Text>
        <Text style={styles.subtitle}>Choose your goals.</Text>
        <View style={styles.options}>
          {motivations.map((motivation) => {
            const isSelected = selectedReasons.includes(motivation);

            return (
              <Pressable
                key={motivation}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggle(motivation)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{motivation}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable style={[styles.cta, !canContinue && styles.ctaDisabled]} disabled={!canContinue} onPress={handleFinish}>
          <BlurView intensity={40} tint="dark" style={styles.ctaBlur} pointerEvents="none">
            <View style={styles.ctaInner}>
              <Text style={styles.ctaText}>Finish</Text>
            </View>
          </BlurView>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
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
  progressWrap: {
    position: 'relative',
    height: 24,
    justifyContent: 'center',
    marginBottom: 20,
  },
  progressBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  progressText: {
    display: 'none',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    opacity: 0.6,
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


