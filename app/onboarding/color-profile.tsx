import { ProgressBar } from '@/components/ProgressBar';
import { useOnboarding } from '@/lib/onboardingContext';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const colorOptionsData = {
  // Default options (women / non-binary)
  default: [
    'I love bright, bold colors',
    'I prefer soft, muted tones',
    'I stick to neutrals & earth tones',
    'I wear a lot of black',
    'I like mixing prints & patterns',
    'I prefer solid colors only',
  ],
  // Options for men
  male: [
    'I prefer dark, muted colors',
    'I stick to neutrals (black, grey, navy)',
    'I\'m open to trying bolder colors',
    'I wear mostly black',
    'I like subtle patterns (stripes, checks)',
    'I prefer solid colors only',
  ],
};

export default function ColorProfileScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  const colorOptions = useMemo(() => {
    if (data.identity === 'Man') {
      return colorOptionsData.male;
    }
    return colorOptionsData.default;
  }, [data.identity]);

  const toggleOption = (option: string) => {
    if (selectedOptions.includes(option)) {
      setSelectedOptions(selectedOptions.filter(opt => opt !== option));
    } else {
      setSelectedOptions([...selectedOptions, option]);
    }
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

        <ProgressBar progress={85} />

        <Text style={styles.title}>What's your relationship with color?</Text>
        <Text style={styles.subtitle}>Select all that apply.</Text>

        <View style={styles.options}>
          {colorOptions.map((option) => {
            const isSelected = selectedOptions.includes(option);
            return (
              <Pressable
                key={option}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleOption(option)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.cta}
          onPress={() => {
            updateData('colorProfile', selectedOptions);
            router.push('/onboarding/fit-profile');
          }}
        >
          <BlurView intensity={40} tint="dark" style={styles.ctaBlur} pointerEvents="none">
            <View style={styles.ctaInner}>
              <Text style={styles.ctaText}>Continue</Text>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 40,
  },
  chip: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  chipSelected: {
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Satoshi',
  },
  chipTextSelected: {
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
