import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Catch-all screen for unmatched routes.
 * 
 * Shows a loading spinner instead of an error because this screen is typically
 * hit briefly when Superwall universal links (Stripe Payment Sheet redemption)
 * arrive and Expo Router tries to route the URL before didRedeemLink navigates
 * the user to the correct screen.
 * 
 * Auto-redirects to home after 3 seconds as a safety net.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  // Safety net: if didRedeemLink doesn't navigate within 3 seconds, go home
  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/(tabs)/rate');
    }, 3000);
    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#999" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});
