import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceAuth } from '@/lib/deviceAuth';
import { loadPersistedProfile } from '@/lib/profile';
import { createMockRating, getRedesignHistory, normalizeRatingResult, rateOutfit, saveRedesignRating } from '@/lib/rater';
import { useRatingSession } from '@/lib/rating-session';

type Outfit = {
    id: string;
    original_image_url: string;
    redesign_image_url: string | null;
    status: 'rated' | 'pending' | 'processing' | 'completed' | 'failed';
    prompt: string;
    score: number;
    label: string;
    rating_data?: any; // Full rating result JSON
    created_at: string;
};

export default function HistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { deviceUUID } = useDeviceAuth();
    const { clearStack, pushCard } = useRatingSession();

    const [outfits, setOutfits] = useState<Outfit[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [openingOutfitId, setOpeningOutfitId] = useState<string | null>(null);

    const loadHistory = async () => {
        if (!deviceUUID) return;
        try {
            const data = await getRedesignHistory(deviceUUID);
            setOutfits(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [deviceUUID]);

    const onRefresh = () => {
        setRefreshing(true);
        loadHistory();
    };

    const openOutfit = async (item: Outfit) => {
        const outfitId = String(item.id);
        if (openingOutfitId === outfitId) return;
        setOpeningOutfitId(outfitId);

        try {
            const originalRaw = item.rating_data || createMockRating();
            const originalResult = normalizeRatingResult(originalRaw);
            const originalResultWithId = { ...originalResult, outfit_id: outfitId };

            let redesignResult: any | null = null;
            const isCompleted = item.status === 'completed';
            const hasRedesignImage = isCompleted && !!item.redesign_image_url;

            if (hasRedesignImage && item.redesign_image_url) {
                const saved = item.rating_data?.redesign_rating_data;
                if (saved) {
                    redesignResult = normalizeRatingResult(saved);
                } else {
                    // One-time backfill: re-rate the generated image (does NOT create a new history row)
                    const profile = await loadPersistedProfile();
                    redesignResult = await rateOutfit(item.redesign_image_url, { profile: profile ?? undefined });

                    // Best-effort: persist so the closet can show it instantly next time.
                    if (deviceUUID) {
                        try {
                            await saveRedesignRating(outfitId, redesignResult, item.redesign_image_url, { deviceUUID });
                        } catch (e) {
                            console.warn('[HistoryScreen] Failed to persist redesign rating:', e);
                        }
                    }
                }
            }

            clearStack();
            const originalCardId = pushCard({
                imageUri: item.original_image_url,
                result: originalResultWithId,
                isRedesign: false,
            });

            if (hasRedesignImage && item.redesign_image_url && redesignResult) {
                pushCard({
                    imageUri: item.redesign_image_url,
                    result: redesignResult,
                    isRedesign: true,
                    parentId: originalCardId,
                });
            }

            router.push('/score');
        } catch (e: any) {
            console.error('[HistoryScreen] Open outfit error:', e);
            Alert.alert('Unable to open result', e?.message || 'Please try again.');
        } finally {
            setOpeningOutfitId(null);
        }
    };

    const renderItem = ({ item }: { item: Outfit }) => {
        const isRated = item.status === 'rated';
        const isCompleted = item.status === 'completed';
        const isProcessing = item.status === 'processing' || item.status === 'pending';
        const isFailed = item.status === 'failed';

        const scoreColor = (item.score || 0) > 80 ? '#34C759' : (item.score || 0) > 50 ? '#FFCC00' : '#FF3B30';

        const handlePress = () => openOutfit(item);

        return (
            <Pressable onPress={handlePress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.scoreBadge}>
                        <Text style={[styles.scoreValue, { color: scoreColor }]}>{item.score || '?'}</Text>
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.labelTitle} numberOfLines={1}>{item.label || 'OUTFIT CHECK'}</Text>
                        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                    {(isProcessing || openingOutfitId === String(item.id)) && <ActivityIndicator size="small" color="#fff" />}
                </View>

                <View style={styles.imageContainer}>
                    {/* Main Image (Original or Redesign preview) */}
                    <View style={styles.mainImageWrapper}>
                        <Image source={{ uri: item.original_image_url }} style={styles.image} resizeMode="cover" />
                        {isCompleted && item.redesign_image_url && (
                            <View style={styles.redesignBadge}>
                                <SymbolView name="sparkles.rectangle.stack.fill" size={14} tintColor="#000" />
                                <Text style={styles.redesignBadgeText}>GLOW UP</Text>
                            </View>
                        )}
                    </View>

                    {/* Status / Call to Action */}
                    <View style={styles.statusContainer}>
                        {isProcessing ? (
                            <Text style={styles.statusText}>✨ Creating glow up...</Text>
                        ) : isCompleted ? (
                            <View style={styles.resultRow}>
                                <SymbolView name="arrow.right.circle.fill" size={20} tintColor="#fff" />
                                <Text style={styles.viewResultText}>View Result</Text>
                            </View>
                        ) : isFailed ? (
                            <Text style={[styles.statusText, { color: '#ff4444' }]}>❌ Redesign failed</Text>
                        ) : (
                            <View style={styles.resultRow}>
                                <SymbolView name="star.circle.fill" size={20} tintColor="#666" />
                                <Text style={[styles.viewResultText, { color: '#999' }]}>Rated</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#000000', '#1a1a1a']}
                style={StyleSheet.absoluteFill}
            />

            <View style={[styles.header, { paddingTop: insets.top }]}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <SymbolView name="chevron.left" size={24} tintColor="#fff" />
                </Pressable>
                <Text style={styles.title}>Your Closet</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            ) : (
                <FlatList
                    data={outfits}
                    renderItem={renderItem}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>No redesigns yet.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 10,
    },
    backButton: {
        padding: 8,
        marginRight: 10,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontFamily: 'BodoniModa',
        fontWeight: '700',
    },
    list: {
        padding: 20,
        gap: 20,
    },
    card: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    scoreBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreValue: {
        fontSize: 18,
        fontWeight: '900',
        fontFamily: 'BodoniModa',
    },
    headerInfo: {
        flex: 1,
    },
    labelTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'BodoniModa',
        marginBottom: 2,
    },
    imageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    mainImageWrapper: {
        width: 80,
        height: 100,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#222',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    redesignBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
        gap: 4,
    },
    redesignBadgeText: {
        color: '#000',
        fontSize: 8,
        fontWeight: '900',
    },
    statusContainer: {
        flex: 1,
        height: 100,
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    statusText: {
        color: '#ccc',
        fontSize: 14,
        fontFamily: 'Satoshi',
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    viewResultText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Satoshi',
    },
    dateText: {
        color: '#666',
        fontSize: 12,
        fontFamily: 'Satoshi',
    },
    empty: {
        paddingTop: 100,
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        fontFamily: 'Satoshi',
    }
});
