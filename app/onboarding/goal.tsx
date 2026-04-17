import { ProgressBar } from '@/components/ProgressBar';
import { useOnboarding } from '@/lib/onboardingContext';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const goalsData = {
  // Default goals (women / non-binary / general)
  default: [
    'Help me learn fashion principles.',
    'Give me quick \'yes/no\' feedback.',
    'Help me discover my personal style.',
    'Get better at coordinating outfits.',
  ],
  // Goals for men
  male: [
    'Help me learn what actually looks good.',
    'Give me quick \'yes/no\' feedback.',
    'Help me build a versatile wardrobe.',
    'Get better at matching colors & pieces.',
  ],
  // Goals for younger users (under 18, 18-24)
  young: [
    'Help me find my aesthetic.',
    'Give me quick \'yes/no\' feedback.',
    'Help me keep up with trends.',
    'Get better at putting outfits together.',
  ],
  // Goals for older users (45+)
  mature: [
    'Help me look polished & put-together.',
    'Give me honest, constructive feedback.',
    'Help me update my style.',
    'Get better at dressing for my lifestyle.',
  ],
};

export default function GoalScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const goals = useMemo(() => {
    const age = data.age;
    const identity = data.identity;

    // Age-specific goals take priority
    if (age === 'Under 18' || age === '18-24') {
      return goalsData.young;
    }
    if (age === '45+') {
      return goalsData.mature;
    }
    // Then gender-specific
    if (identity === 'Man') {
      return goalsData.male;
    }
    return goalsData.default;
  }, [data.age, data.identity]);

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

        <ProgressBar progress={25} />

        <Text style={styles.title}>What brings you here?</Text>
        <Text style={styles.subtitle}>Select your main goal.</Text>

        <View style={styles.options}>
          {goals.map((goal) => (
            <Pressable
              key={goal}
              style={[styles.option, selected === goal && styles.optionSelected]}
              onPress={() => setSelected(goal)}
            >
              <Text style={[styles.optionText, selected === goal && styles.optionTextSelected]}>{goal}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.cta, !selected && styles.ctaDisabled]}
          disabled={!selected}
          onPress={() => {
            updateData('goal', selected);
            router.push('/onboarding/spectrum');
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
