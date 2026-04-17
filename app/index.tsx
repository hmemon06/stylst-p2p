import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { isOnboardingCompleted } from '@/lib/onboarding';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const checkOnboardingStatus = async () => {
        setIsLoading(true);
        try {
          const completed = await isOnboardingCompleted();
          if (isActive) {
            setHasCompletedOnboarding(completed);
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      checkOnboardingStatus();

      return () => {
        isActive = false;
      };
    }, [])
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3CBA9A" />
      </View>
    );
  }

  return <Redirect href={hasCompletedOnboarding ? "/(tabs)/rate" : "/onboarding/intro"} />;
}
