import * as AppleAuthentication from 'expo-apple-authentication';
import { BlurView } from 'expo-blur';
import * as Crypto from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceAuth } from '@/lib/deviceAuth';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti piece component
const ConfettiPiece = ({ delay, x, color }: { delay: number; x: number; color: string }) => {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(x);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 100, { duration: 3000 + Math.random() * 2000 })
    );
    translateX.value = withDelay(
      delay,
      withSequence(
        withTiming(x + (Math.random() - 0.5) * 100, { duration: 1000 }),
        withTiming(x + (Math.random() - 0.5) * 150, { duration: 1500 }),
        withTiming(x + (Math.random() - 0.5) * 100, { duration: 1500 })
      )
    );
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 1000 }), -1, false)
    );
    opacity.value = withDelay(delay + 2500, withTiming(0, { duration: 500 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 10 + Math.random() * 10,
          height: 10 + Math.random() * 10,
          backgroundColor: color,
          borderRadius: Math.random() > 0.5 ? 10 : 2,
        },
        animatedStyle,
      ]}
    />
  );
};

// Generate confetti pieces
const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
const generateConfetti = () => {
  return Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 1000,
    x: Math.random() * SCREEN_WIDTH,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  }));
};

const AFFIRMATIONS = [
  "You're about to become unstoppable 💫",
  "Your style journey starts now ✨",
  "Main character energy unlocked 🌟",
  "Get ready to slay every day 👑",
  "Your glow-up era begins 🔥",
];

// Error message helper
const getErrorMessage = (error: any): string => {
  const message = error?.message || '';

  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (message.includes('User already registered') || message.includes('already registered')) {
    return 'This email is already registered. Try signing in instead.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account.';
  }
  if (message.includes('Password')) {
    return 'Password must be at least 6 characters.';
  }
  if (message.includes('Invalid email')) {
    return 'Please enter a valid email address.';
  }

  return 'Something went wrong. Please try again.';
};

export default function WelcomeProScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deviceUUID } = useDeviceAuth();
  const [confetti] = useState(generateConfetti());
  const [affirmation] = useState(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);

  // Auth state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Crown animation
  const crownScale = useSharedValue(0);
  const crownRotate = useSharedValue(-10);

  useEffect(() => {
    crownScale.value = withDelay(300, withSpring(1, { damping: 8 }));
    crownRotate.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(10, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-10, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const crownAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: crownScale.value },
      { rotate: `${crownRotate.value}deg` },
    ],
  }));

  // Link Supabase auth user to our users table
  const linkAuthToDevice = async (authUserId: string, userEmail?: string | null, provider?: string) => {
    if (!deviceUUID) return false;

    try {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };

      if (userEmail) updates.email = userEmail;
      if (provider === 'apple') updates.apple_id = authUserId;

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('device_uuid', deviceUUID);

      if (error) {
        console.error('[WelcomePro] Failed to link auth:', error);
        return false;
      }

      console.log('[WelcomePro] Successfully linked auth to device:', { authUserId, userEmail, provider });
      return true;
    } catch (e) {
      console.error('[WelcomePro] Exception linking auth:', e);
      return false;
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);

      // Generate nonce for security
      const rawNonce = Math.random().toString(36).substring(2, 15);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Sign in with Supabase using Apple token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) {
        console.error('[WelcomePro] Supabase Apple auth error:', error);
        throw error;
      }

      // Apple only provides the user's full name on the FIRST sign-in.
      // We must save it to user metadata now or lose it.
      if (credential.fullName) {
        const nameParts = [];
        if (credential.fullName.givenName) nameParts.push(credential.fullName.givenName);
        if (credential.fullName.familyName) nameParts.push(credential.fullName.familyName);

        const fullName = nameParts.join(' ');
        if (fullName) {
          await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              given_name: credential.fullName.givenName,
              family_name: credential.fullName.familyName,
            }
          });
        }
      }

      // Link auth user to our users table
      await linkAuthToDevice(
        data.user?.id || credential.user,
        credential.email || data.user?.email,
        'apple'
      );

      Alert.alert('Success! 🎉', 'Your subscription is now protected with Apple.', [
        { text: 'Let\'s Go!', onPress: () => router.replace('/(tabs)/rate') }
      ]);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        console.error('[WelcomePro] Apple Sign In error:', e);
        Alert.alert('Error', 'Apple Sign In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);

      if (isSignUp) {
        // Try to sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          // If user already exists, suggest sign in
          if (error.message?.includes('already registered')) {
            Alert.alert(
              'Account Exists',
              'This email is already registered. Would you like to sign in instead?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign In', onPress: () => setIsSignUp(false) }
              ]
            );
            return;
          }
          throw error;
        }

        if (data.user) {
          await linkAuthToDevice(data.user.id, email, 'email');
          Alert.alert('Success! 🎉', 'Your subscription is now protected with your email.', [
            { text: 'Let\'s Go!', onPress: () => router.replace('/(tabs)/rate') }
          ]);
        }
      } else {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          await linkAuthToDevice(data.user.id, email, 'email');
          Alert.alert('Welcome back! 🎉', 'Your subscription is now linked.', [
            { text: 'Let\'s Go!', onPress: () => router.replace('/(tabs)/rate') }
          ]);
        }
      }
    } catch (e: any) {
      console.error('[WelcomePro] Email auth error:', e);
      Alert.alert('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Are you sure?',
      'Without linking an account, you might lose your subscription if you switch devices.',
      [
        { text: 'Link Account', style: 'cancel' },
        { text: 'Skip Anyway', style: 'destructive', onPress: () => router.replace('/(tabs)/rate') }
      ]
    );
  };

  const isPasswordValid = password.length >= 6;
  const canSubmit = email.length > 0 && isPasswordValid && !loading;

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f0f23']}
        style={StyleSheet.absoluteFill}
      />

      {/* Confetti layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {confetti.map((piece) => (
          <ConfettiPiece key={piece.id} {...piece} />
        ))}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Crown with glow */}
        <Animated.View style={[styles.crownContainer, crownAnimatedStyle]}>
          <Text style={styles.crown}>👑</Text>
          <View style={styles.crownGlow} />
        </Animated.View>

        {/* Welcome text */}
        <Animated.Text
          entering={FadeInDown.delay(400).duration(600)}
          style={styles.welcomeText}
        >
          Welcome to PRO
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(600).duration(600)}
          style={styles.affirmation}
        >
          {affirmation}
        </Animated.Text>

        {/* Benefits */}
        <Animated.View
          entering={FadeInUp.delay(800).duration(600)}
          style={styles.benefitsContainer}
        >
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>∞</Text>
            <Text style={styles.benefitText}>Unlimited Scans</Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>✨</Text>
            <Text style={styles.benefitText}>Monthly Redesigns</Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>🎯</Text>
            <Text style={styles.benefitText}>AI Style Analysis</Text>
          </View>
        </Animated.View>

        {/* Protect subscription section */}
        <Animated.View
          entering={FadeIn.delay(1200).duration(600)}
          style={styles.protectSection}
        >
          <BlurView intensity={20} tint="dark" style={styles.protectCard}>
            <Text style={styles.protectTitle}>🔐 Protect Your Subscription</Text>
            <Text style={styles.protectSubtitle}>
              Link your account so you never lose access, even on a new device.
            </Text>

            {!showEmailForm ? (
              <View style={styles.authButtons}>
                {/* Apple Sign In (iOS only) */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.appleButton, loading && styles.buttonDisabled]}
                    onPress={handleAppleSignIn}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.appleButtonText}> Continue with Apple</Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* Email */}
                <TouchableOpacity
                  style={styles.emailButton}
                  onPress={() => setShowEmailForm(true)}
                  disabled={loading}
                >
                  <Text style={styles.emailButtonText}>✉️ Continue with Email</Text>
                </TouchableOpacity>

                <Text style={styles.privacyNote}>
                  We'll never share your information.{'\n'}This just protects your subscription.
                </Text>
              </View>
            ) : (
              <Animated.View entering={FadeIn.duration(300)} style={styles.emailForm}>
                <Text style={styles.formTitle}>
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password (min 6 characters)"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />

                {password.length > 0 && !isPasswordValid && (
                  <Text style={styles.errorText}>
                    ⚠️ Password must be at least 6 characters
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                  onPress={handleEmailAuth}
                  disabled={!canSubmit}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {isSignUp ? 'Create Account' : 'Sign In'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setIsSignUp(!isSignUp)}
                  disabled={loading}
                >
                  <Text style={styles.toggleText}>
                    {isSignUp
                      ? 'Already have an account? Sign in'
                      : 'New here? Create account'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setShowEmailForm(false);
                    setEmail('');
                    setPassword('');
                    setIsSignUp(true);
                  }}
                  disabled={loading}
                >
                  <Text style={styles.backButtonText}>← Back to options</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>

        {/* Skip button */}
        <Animated.View entering={FadeIn.delay(1500).duration(600)}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={loading}>
            <Text style={styles.skipText}>Maybe Later</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  crownContainer: {
    marginBottom: 16,
  },
  crown: {
    fontSize: 80,
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  crownGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    top: -10,
    left: -10,
  },
  welcomeText: {
    fontFamily: 'BodoniModa',
    fontSize: 42,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  affirmation: {
    fontFamily: 'Satoshi',
    fontSize: 18,
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 24,
  },
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  benefit: {
    alignItems: 'center',
    gap: 4,
  },
  benefitIcon: {
    fontSize: 24,
  },
  benefitText: {
    fontFamily: 'Satoshi',
    fontSize: 12,
    color: '#aaa',
  },
  protectSection: {
    width: '100%',
    marginBottom: 16,
  },
  protectCard: {
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  protectTitle: {
    fontFamily: 'Satoshi',
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  protectSubtitle: {
    fontFamily: 'Satoshi',
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  authButtons: {
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  appleButtonText: {
    fontFamily: 'Satoshi',
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  emailButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  emailButtonText: {
    fontFamily: 'Satoshi',
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  privacyNote: {
    fontFamily: 'Satoshi',
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  emailForm: {
    gap: 12,
  },
  formTitle: {
    fontFamily: 'Satoshi',
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: 'Satoshi',
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorText: {
    fontFamily: 'Satoshi',
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: -8,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: 'Satoshi',
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    fontFamily: 'Satoshi',
    fontSize: 14,
    color: '#FFD700',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    fontFamily: 'Satoshi',
    fontSize: 14,
    color: '#888',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipText: {
    fontFamily: 'Satoshi',
    fontSize: 14,
    color: '#666',
  },
});
