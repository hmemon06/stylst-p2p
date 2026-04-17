import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceAuth } from '@/lib/deviceAuth';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { linkAccount } = useDeviceAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleEmailAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setLoading(true);
        try {
            let authResponse;
            if (isSignUp) {
                authResponse = await supabase.auth.signUp({
                    email,
                    password,
                });
            } else {
                authResponse = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
            }

            const { data, error } = authResponse;

            if (error) throw error;

            if (data.user) {
                // Link the authenticated user with the device UUID
                await linkAccount({ email: data.user.email });

                Alert.alert(
                    'Success',
                    isSignUp ? 'Account created and linked!' : 'Signed in successfully!',
                    [{ text: 'OK', onPress: () => router.back() }]
                );
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAppleAuth = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (credential.identityToken) {
                const {
                    error,
                    data: { user },
                } = await supabase.auth.signInWithIdToken({
                    provider: 'apple',
                    token: credential.identityToken,
                });

                if (error) throw error;

                if (user) {
                    // Update user metadata if name is available (only on first sign in)
                    if (credential.fullName) {
                        const nameParts = [];
                        if (credential.fullName.givenName) nameParts.push(credential.fullName.givenName);
                        if (credential.fullName.familyName) nameParts.push(credential.fullName.familyName);

                        const fullName = nameParts.join(' ');

                        await supabase.auth.updateUser({
                            data: {
                                full_name: fullName,
                                given_name: credential.fullName.givenName,
                                family_name: credential.fullName.familyName,
                            }
                        });
                    }

                    // Link account
                    await linkAccount({
                        apple_id: user.id,
                        email: user.email
                    });

                    Alert.alert(
                        'Success',
                        'Signed in with Apple successfully!',
                        [{ text: 'OK', onPress: () => router.back() }]
                    );
                }
            } else {
                throw new Error('No identityToken provided by Apple.');
            }
        } catch (e: any) {
            if (e.code === 'ERR_REQUEST_CANCELED') {
                // User canceled
            } else {
                console.error('Apple Sign-In Error:', e);
                Alert.alert('Error', 'Failed to sign in with Apple.');
            }
        }
    };

    const handleOAuth = async (provider: 'google') => {
        Alert.alert('Coming Soon', `${provider} sign-in is not yet configured.`);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </Pressable>
                <Text style={styles.title}>Link Account</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.subtitle}>
                        Sign in to save your subscription and access it on other devices.
                    </Text>

                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#666"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#666"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <Pressable
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleEmailAuth}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="black" />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isSignUp ? 'Create Account' : 'Sign In'}
                                </Text>
                            )}
                        </Pressable>

                        <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.switchButton}>
                            <Text style={styles.switchText}>
                                {isSignUp ? 'Already have an account? Sign In' : 'New here? Create Account'}
                            </Text>
                        </Pressable>
                    </View>

                    <View style={styles.divider}>
                        <View style={styles.line} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.line} />
                    </View>

                    <View style={styles.socialButtons}>
                        {Platform.OS === 'ios' ? (
                            <AppleAuthentication.AppleAuthenticationButton
                                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                                cornerRadius={12}
                                style={styles.appleButton}
                                onPress={handleAppleAuth}
                            />
                        ) : (
                            // Fallback for Android or if native button fails to render
                            <Pressable style={styles.socialButton} onPress={() => Alert.alert('Notice', 'Apple Sign-In is only available on iOS devices.')}>
                                <Ionicons name="logo-apple" size={24} color="white" />
                                <Text style={styles.socialButtonText}>Continue with Apple</Text>
                            </Pressable>
                        )}

                        <Pressable style={styles.socialButton} onPress={() => handleOAuth('google')}>
                            <Ionicons name="logo-google" size={24} color="white" />
                            <Text style={styles.socialButtonText}>Continue with Google</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
        marginRight: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        fontFamily: 'BodoniModa',
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        padding: 24,
    },
    subtitle: {
        color: '#999',
        fontSize: 16,
        marginBottom: 32,
        lineHeight: 24,
    },
    form: {
        gap: 16,
    },
    input: {
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 16,
        color: 'white',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    button: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: 'black',
        fontSize: 16,
        fontWeight: 'bold',
    },
    switchButton: {
        alignItems: 'center',
        padding: 8,
    },
    switchText: {
        color: '#999',
        fontSize: 14,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 32,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#333',
    },
    dividerText: {
        color: '#666',
        paddingHorizontal: 16,
        fontSize: 12,
    },
    socialButtons: {
        gap: 12,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#333',
        gap: 12,
    },
    socialButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    appleButton: {
        width: '100%',
        height: 54,
    },
});
