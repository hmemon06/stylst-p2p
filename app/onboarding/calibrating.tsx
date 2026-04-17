import { markOnboardingCompleted, saveOnboardingData } from '@/lib/onboarding';
import { useOnboarding } from '@/lib/onboardingContext';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const loadingMessages = [
  'Analyzing your style profile...',
  'Building your Style DNA...',
  'Calibrating your personal AI...',
];

export default function CalibratingScreen() {
  const router = useRouter();
  const { data } = useOnboarding();
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    // Cycle through loading messages
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1500);

    // Save data and complete onboarding after minimum 3 seconds
    const saveData = async () => {
      try {
        await saveOnboardingData(data);
        await markOnboardingCompleted();
      } catch (error) {
        console.error('Error saving onboarding data:', error);
      }
    };

    const timer = setTimeout(() => {
      clearInterval(messageInterval);
      saveData().then(() => {
        router.replace('/onboarding/grant');
      });
    }, 3000);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(timer);
    };
  }, [data, router]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
          <Text style={styles.loadingText}>{loadingMessages[currentMessageIndex]}</Text>
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
    paddingHorizontal: 24,
    paddingTop: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    fontFamily: 'Satoshi',
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
});
