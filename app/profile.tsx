import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { usePlacement } from 'expo-superwall';
import Superwall from 'expo-superwall/compat';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Clipboard,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceAuth } from '@/lib/deviceAuth';
import { loadPersistedProfile, PersistedProfile, savePersistedProfile } from '@/lib/profile';

// Debug mode: only enabled when EXPO_PUBLIC_PRODUCTION is explicitly set to 'false'
const IS_DEBUG_MODE = process.env.EXPO_PUBLIC_PRODUCTION === 'false';

export default function ProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isPremium, redesignCredits, deviceUUID, restoreSubscription, refreshPremiumStatus, addRedesignCredit, resetTrial, redeemPromoCode } = useDeviceAuth();

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<PersistedProfile>({});
    const [hasChanges, setHasChanges] = useState(false);
    const [promoCode, setPromoCode] = useState('');

    // Track if user was already premium when paywall was shown (to distinguish subscription vs credit purchase)
    const wasPremiumRef = React.useRef(isPremium);

    // Setup Superwall paywall
    const { registerPlacement } = usePlacement({
        onPresent: (info: any) => {
            console.log('[Superwall] Profile paywall presented:', info);
            // Capture premium status when paywall opens
            wasPremiumRef.current = isPremium;
        },
        onDismiss: async (info: any, result: any) => {
            console.log('[Superwall] Profile paywall dismissed:', info, 'Result:', result);
            const paywallResult = result as any;
            const purchased =
                paywallResult?.state === 'purchased' ||
                paywallResult?.type === 'purchased' ||
                paywallResult?.purchased === true ||
                paywallResult?.transaction != null ||
                (typeof result === 'string' && (result as string).toLowerCase().includes('purchased'));

            if (purchased) {
                const wasAlreadyPremium = wasPremiumRef.current;

                if (!wasAlreadyPremium) {
                    // SUBSCRIPTION purchase via Stripe Payment Sheet (trial_ended placement)
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    await refreshPremiumStatus();
                    router.push('/welcome-pro');
                } else {
                    // CREDIT purchase via IAP / RevenueCat (on_pro_out_of_redesigns placement)
                    try {
                        const { syncPurchases } = await import('@/lib/revenuecat');
                        await syncPurchases();
                    } catch (e) {
                        console.warn('[Superwall] Failed to sync purchases to RevenueCat:', e);
                    }
                    await refreshPremiumStatus();

                    // Detect credit amount from product info
                    const productId = paywallResult?.product?.productIdentifier
                        || paywallResult?.productId
                        || paywallResult?.transaction?.productIdentifier
                        || '';

                    // Match product ID to credit amount (3, 10, or 25)
                    let creditAmount = 3; // default to smallest
                    if (productId.includes('25') || productId.toLowerCase().includes('twenty')) {
                        creditAmount = 25;
                    } else if (productId.includes('10') || productId.toLowerCase().includes('ten')) {
                        creditAmount = 10;
                    } else if (productId.includes('3') || productId.toLowerCase().includes('three')) {
                        creditAmount = 3;
                    }

                    console.log('[Superwall] Credit purchase detected, productId:', productId, 'credits:', creditAmount);

                    // Optimistically update credits so user can use them immediately
                    addRedesignCredit(creditAmount);
                }
            }
        },
        onError: (error: any) => {
            console.error('[Superwall] Profile paywall error:', error);
        },
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await loadPersistedProfile();
        if (data) {
            setProfile(data);
        }
        setLoading(false);
    };

    const handleChange = (key: string, value: any) => {
        setProfile((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setLoading(true);
        const success = await savePersistedProfile(profile);
        setLoading(false);
        if (success) {
            setHasChanges(false);
            Alert.alert('Success', 'Profile updated successfully.');
        } else {
            Alert.alert('Error', 'Failed to save profile.');
        }
    };

    const copyUUID = () => {
        if (deviceUUID) {
            Clipboard.setString(deviceUUID);
            Alert.alert('Copied', 'Device ID copied to clipboard');
        }
    };

    const handleRestore = async () => {
        setLoading(true);
        const success = await restoreSubscription();
        setLoading(false);
        if (success) {
            Alert.alert('Success', 'Purchases restored.');
        } else {
            Alert.alert('Notice', 'No active subscriptions found to restore.');
        }
    };

    const handleDeleteAccount = async () => {
        if (!deviceUUID) return;

        setLoading(true);
        try {
            // 1. Call backend to delete data
            // Use EXPO_PUBLIC_API_URL if available, otherwise fallback to local/constructed URL logic
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const apiUrl = process.env.EXPO_PUBLIC_API_URL
                ? process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '')
                : (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/api` : 'http://localhost:3000');

            // Construct endpoint - handling both Next.js/Express and Supabase Edge Function paths if needed
            // For now assuming Express backend structure as per server.js modification
            const endpoint = `${apiUrl}/user/${deviceUUID}`;

            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-uuid': deviceUUID
                }
            });

            if (!response.ok) {
                // If it's 404, maybe user already deleted? Continue to cleanup locally anyway.
                if (response.status !== 404) {
                    throw new Error(`Server returned ${response.status}`);
                }
            }

            // 2. Clear local storage
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const SecureStore = require('expo-secure-store');

            // Clear specific keys we know about
            await AsyncStorage.removeItem(`scan_count:${deviceUUID}`);
            await AsyncStorage.removeItem(`redesign_credits:${deviceUUID}`);
            await AsyncStorage.removeItem('onboarding_completed');

            // Clear secure store UUID
            await SecureStore.deleteItemAsync('deviceUUID');

            // 3. Reset application state
            // We need to force a reset. The easiest way is to reload the app or navigate to initial screen
            // triggering a fresh auth flow check which will generate a new UUID.

            Alert.alert('Account Deleted', 'Your account has been successfully deleted.');

            // Navigate to intro - this might require a reload to truly regenerate UUID in context
            // Ideally we'd have a method in context to "reset" entirely, but this is a good start.
            router.replace('/');

        } catch (error) {
            console.error('Delete account error:', error);
            Alert.alert('Error', 'Failed to delete account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (label: string, key: string, placeholder: string, multiline = false) => (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={[styles.input, multiline && styles.textArea]}
                value={String(profile[key] || '')}
                onChangeText={(text) => handleChange(key, text)}
                placeholder={placeholder}
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline={multiline}
                blurOnSubmit={!multiline}
            />
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.container}>
                    <StatusBar barStyle="light-content" />

                    {/* Background */}
                    <LinearGradient
                        colors={['#0F0F0F', '#1A1A1A']}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Header */}
                    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                            <SymbolView name="xmark" size={20} tintColor="white" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Profile</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView
                        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Subscription Card */}
                        <View style={styles.card}>
                            <LinearGradient
                                colors={isPremium ? ['#2A2A2A', '#222'] : ['#222', '#1A1A1A']}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.cardHeader}>
                                <SymbolView
                                    name={isPremium ? "crown.fill" : "person.fill"}
                                    size={24}
                                    tintColor={isPremium ? "#FFD700" : "#AAA"}
                                />
                                <Text style={styles.cardTitle}>
                                    {isPremium ? 'PREMIUM MEMBER' : 'FREE ACCOUNT'}
                                </Text>
                            </View>

                            <View style={styles.statRow}>
                                <View style={styles.stat}>
                                    <Text style={styles.statValue}>{isPremium ? '∞' : redesignCredits}</Text>
                                    <Text style={styles.statLabel}>Redesigns</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.stat}>
                                    <Text style={styles.statValue}>{isPremium ? 'Active' : 'Inactive'}</Text>
                                    <Text style={styles.statLabel}>Status</Text>
                                </View>
                            </View>

                            {!isPremium && (
                                <TouchableOpacity
                                    style={styles.upgradeButton}
                                    onPress={async () => {
                                        try {
                                            await registerPlacement({ placement: 'trial_ended' });
                                        } catch (error) {
                                            console.error('[Superwall] Error showing paywall:', error);
                                        }
                                    }}
                                >
                                    <Text style={styles.upgradeText}>Upgrade to Pro</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity onPress={copyUUID} style={styles.uuidContainer}>
                                <Text style={styles.uuidLabel}>Device ID:</Text>
                                <Text style={styles.uuid} numberOfLines={1} ellipsizeMode="middle">
                                    {deviceUUID}
                                </Text>
                                <SymbolView name="doc.on.doc" size={12} tintColor="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleRestore} style={styles.linkButton}>
                                <Text style={styles.linkText}>Restore Purchases</Text>
                            </TouchableOpacity>

                            {!isPremium && (
                                <View style={styles.promoContainer}>
                                    <TextInput
                                        style={styles.promoInput}
                                        placeholder="Promo Code"
                                        placeholderTextColor="#666"
                                        value={promoCode}
                                        onChangeText={setPromoCode}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                    />
                                    <TouchableOpacity
                                        style={styles.promoButton}
                                        onPress={async () => {
                                            if (!promoCode.trim()) return;
                                            const success = await redeemPromoCode(promoCode);
                                            if (success) {
                                                setPromoCode('');
                                                router.push('/welcome-pro');
                                            } else {
                                                Alert.alert('Invalid Code', 'The promo code you entered is not valid.');
                                            }
                                        }}
                                    >
                                        <Text style={styles.promoButtonText}>Redeem</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* Style DNA Section */}
                        <Text style={styles.sectionTitle}>STYLE DNA</Text>

                        {renderInput('Identity / Name', 'identity', 'What should we call you?')}
                        {renderInput('Age', 'age', 'e.g. 24')}
                        {renderInput('Style Goal', 'goal', 'e.g. Look more professional, Dress edgier...', true)}

                        {/* Visual Taste (ReadOnly) */}
                        <View style={styles.inputGroup}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={styles.label}>Style Preferences</Text>
                                <TouchableOpacity onPress={() => {
                                    Alert.alert(
                                        'Retake Style Audit?',
                                        'This will reset your style profile and take you back to the style quiz.',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Retake',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    const { resetOnboarding } = require('@/lib/onboarding');
                                                    await resetOnboarding();
                                                    router.replace('/onboarding/intro'); // Or specific step
                                                }
                                            }
                                        ]
                                    );
                                }}>
                                    <Text style={{ color: '#CCFF00', fontSize: 12, fontWeight: 'bold' }}>RETAKE AUDIT</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.tags}>
                                {Array.isArray(profile.visualTasteResults) && profile.visualTasteResults.map((tag: any, i: number) => (
                                    <View key={i} style={styles.tag}>
                                        <Text style={styles.tagText}>{typeof tag === 'string' ? tag : tag.style}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.spacer} />

                        {/* Legal Links */}
                        <Text style={styles.sectionTitle}>LEGAL</Text>
                        <View style={styles.legalLinks}>
                            <TouchableOpacity
                                onPress={() => Linking.openURL('https://stylstai.github.io/docs/privacy.html')}
                                style={styles.legalLink}
                            >
                                <SymbolView name="hand.raised.fill" size={16} tintColor="#888" />
                                <Text style={styles.legalLinkText}>Privacy Policy</Text>
                                <SymbolView name="arrow.up.right" size={12} tintColor="#666" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => Linking.openURL('https://stylstai.github.io/docs/terms.html')}
                                style={styles.legalLink}
                            >
                                <SymbolView name="doc.text.fill" size={16} tintColor="#888" />
                                <Text style={styles.legalLinkText}>Terms of Service</Text>
                                <SymbolView name="arrow.up.right" size={12} tintColor="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* Delete Account */}
                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    'Delete Account',
                                    'Are you sure you want to delete your account? This action cannot be undone and you will lose all your data.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: handleDeleteAccount
                                        }
                                    ]
                                );
                            }}
                            style={[styles.legalLink, { marginTop: 20, borderColor: '#FF3B30', backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}
                        >
                            <SymbolView name="trash.fill" size={16} tintColor="#FF3B30" />
                            <Text style={[styles.legalLinkText, { color: '#FF3B30' }]}>Delete Account</Text>
                        </TouchableOpacity>

                        {/* Debug Reset Section - only visible in debug mode */}
                        {IS_DEBUG_MODE && (
                            <>
                                <Text style={[styles.sectionTitle, { marginTop: 30 }]}>DEBUG</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.alert(
                                            'Reset Subscription State',
                                            'This will:\n\n• Set is_premium = false in Supabase\n• Clear Stripe subscription fields\n• Reset local premium state\n• Reset Superwall user state\n• Reset trial counters\n\nYou will need to clear StoreKit sandbox purchase history separately in Settings > App Store > Sandbox Account.',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Reset Everything',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        try {
                                                            setLoading(true);

                                                            // 1. Reset Supabase: is_premium, stripe fields, payment_platform
                                                            const { supabase } = await import('@/lib/supabase');
                                                            const { error: dbError } = await supabase
                                                                .from('users')
                                                                .update({
                                                                    is_premium: false,
                                                                    plan: null,
                                                                    stripe_customer_id: null,
                                                                    stripe_subscription_id: null,
                                                                    payment_platform: 'iap',
                                                                    subscription_started_at: null,
                                                                    updated_at: new Date().toISOString(),
                                                                })
                                                                .eq('device_uuid', deviceUUID);

                                                            if (dbError) {
                                                                console.warn('[Debug] Supabase reset error:', dbError);
                                                            } else {
                                                                console.log('[Debug] Supabase subscription fields reset');
                                                            }

                                                            // 2. Reset trial (scans + credits + local AsyncStorage)
                                                            await resetTrial();

                                                            // 3. Reset Superwall user identity
                                                            try {
                                                                await Superwall.shared.reset();
                                                                console.log('[Debug] Superwall reset');
                                                            } catch (swErr) {
                                                                console.warn('[Debug] Superwall reset error (non-fatal):', swErr);
                                                            }

                                                            // 4. Re-identify with Superwall
                                                            if (deviceUUID) {
                                                                try {
                                                                    await Superwall.shared.identify({ userId: deviceUUID });
                                                                    console.log('[Debug] Re-identified with Superwall as:', deviceUUID);
                                                                } catch (idErr) {
                                                                    console.warn('[Debug] Superwall re-identify error (non-fatal):', idErr);
                                                                }
                                                            }

                                                            // 5. Refresh premium status from backend
                                                            await refreshPremiumStatus();

                                                            setLoading(false);
                                                            Alert.alert(
                                                                'Reset Complete',
                                                                'Subscription state has been reset.\n\nRemember to also clear StoreKit sandbox purchase history in Settings > App Store > Sandbox Account if you want to test IAP again.'
                                                            );
                                                        } catch (err) {
                                                            setLoading(false);
                                                            console.error('[Debug] Reset error:', err);
                                                            Alert.alert('Error', 'Reset failed: ' + String(err));
                                                        }
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                    style={[styles.legalLink, { marginTop: 10, borderColor: '#FF9500', backgroundColor: 'rgba(255, 149, 0, 0.1)' }]}
                                >
                                    <SymbolView name="arrow.counterclockwise" size={16} tintColor="#FF9500" />
                                    <Text style={[styles.legalLinkText, { color: '#FF9500' }]}>Reset Subscription State</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={async () => {
                                        try {
                                            const { supabase } = await import('@/lib/supabase');
                                            const { data } = await supabase
                                                .from('users')
                                                .select('is_premium, plan, stripe_customer_id, stripe_subscription_id, payment_platform, redesign_credits, scan_count')
                                                .eq('device_uuid', deviceUUID)
                                                .single();

                                            Alert.alert(
                                                'Current DB State',
                                                JSON.stringify(data, null, 2)
                                            );
                                        } catch (err) {
                                            Alert.alert('Error', String(err));
                                        }
                                    }}
                                    style={[styles.legalLink, { marginTop: 10, borderColor: '#5856D6', backgroundColor: 'rgba(88, 86, 214, 0.1)' }]}
                                >
                                    <SymbolView name="magnifyingglass" size={16} tintColor="#5856D6" />
                                    <Text style={[styles.legalLinkText, { color: '#5856D6' }]}>View DB State</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        <View style={styles.spacer} />

                    </ScrollView>

                    {/* Save Button */}
                    {hasChanges && (
                        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
                            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={handleSave}
                                disabled={loading}
                            >
                                <Text style={styles.saveButtonText}>
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F0F',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#0F0F0F',
        zIndex: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'BodoniModa',
        letterSpacing: 1,
    },
    content: {
        padding: 20,
    },
    card: {
        borderRadius: 20,
        padding: 24,
        marginBottom: 30,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
    },
    cardTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    stat: {
        alignItems: 'center',
        gap: 4,
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    statValue: {
        color: 'white',
        fontSize: 24,
        fontWeight: '700',
        fontFamily: 'BodoniModa',
    },
    statLabel: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    upgradeButton: {
        backgroundColor: 'white',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    upgradeText: {
        color: 'black',
        fontWeight: 'bold',
        fontSize: 16,
    },
    uuidContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        marginBottom: 8,
    },
    uuidLabel: {
        color: '#666',
        fontSize: 12,
    },
    uuid: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'SpaceMono',
        maxWidth: 200,
    },
    linkButton: {
        alignItems: 'center',
        padding: 8,
    },
    linkText: {
        color: '#888',
        fontSize: 12,
        textDecorationLine: 'underline',
    },
    promoContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    promoInput: {
        flex: 1,
        backgroundColor: '#222',
        color: 'white',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    promoButton: {
        backgroundColor: 'white',
        borderRadius: 8,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    promoButtonText: {
        color: 'black',
        fontWeight: 'bold',
        fontSize: 14,
    },
    sectionTitle: {
        color: '#666',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 16,
        marginTop: 10,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#222',
        color: 'white',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    textArea: {
        height: 100,
        paddingTop: 16,
        textAlignVertical: 'top',
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: '#333',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    tagText: {
        color: '#CCC',
        fontSize: 14,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
    },
    saveButton: {
        backgroundColor: '#CCFF00',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#CCFF00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    saveButtonText: {
        color: 'black',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    spacer: {
        height: 100,
    },
    legalLinks: {
        gap: 12,
        marginBottom: 20,
    },
    legalLink: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#222',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: 12,
    },
    legalLinkText: {
        color: '#CCC',
        fontSize: 16,
        flex: 1,
    },
});
