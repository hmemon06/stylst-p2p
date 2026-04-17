import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const stylesList = [
  'Streetwear',
  'Gorpcore',
  'Minimalist',
  'Casual',
  'Business Casual',
  'Y2K',
  'Vintage',
  'Athleisure',
  'Avant-Garde',
];

export default function PreferencesScreen() {
  const router = useRouter();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  const toggle = (list: string[], setList: (s: string[]) => void, value: string) => {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value));
    } else {
      setList([...list, value]);
    }
  };

  const canContinue = selectedStyles.length > 0;

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
          <View style={[styles.progressFill, { width: '75%' }]} />
        </View>
        <Text style={styles.title}>Tell us your style interests</Text>
        <Text style={styles.subtitle}>Pick a few that match your ideal vibe.</Text>
        <View style={styles.chipsWrap}>
          {stylesList.map((s) => (
            <Pressable key={s} style={[styles.chip, selectedStyles.includes(s) && styles.chipSelected]} onPress={() => toggle(selectedStyles, setSelectedStyles, s)}>
              <Text style={[styles.chipText, selectedStyles.includes(s) && styles.chipTextSelected]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.cta, !canContinue && styles.ctaDisabled]} disabled={!canContinue} onPress={() => router.push('/onboarding/motivation')}>
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
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Satoshi',
    marginBottom: 16,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
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


