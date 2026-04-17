import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSuperwall, useUser } from 'expo-superwall';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from './supabase';

import {
  addCustomerInfoUpdateListener,
  checkPremiumStatus,
  configureRevenueCat,
  extractPremiumStatus,
  getSubscriptionType,
  restorePurchases,
  setRevenueCatUserID,
} from './revenuecat';
import { getUser, linkUser, logDevice, updateSubscription } from './supabase';

type CustomerInfo = any; // Use any to avoid import issues

type SubscriptionType = 'weekly' | 'monthly' | 'yearly' | null;

type DeviceAuthContextType = {
  deviceUUID?: string;
  email: string | null;
  scanCount: number;
  redesignCredits: number;
  loading: boolean;
  canScan: boolean;
  canRedesign: boolean;
  isPremium: boolean;
  subscriptionType: SubscriptionType;
  expirationDate: string | null;
  incrementScanCount: () => Promise<number>;
  useRedesignCredit: () => Promise<number>;
  addRedesignCredit: (amount: number) => Promise<void>;
  refundRedesignCredit: () => Promise<number>;
  resetTrial: () => Promise<void>;
  refreshPremiumStatus: () => Promise<void>;
  restoreSubscription: () => Promise<boolean>;
  linkAccount: (data: { email?: string; apple_id?: string; google_id?: string }) => Promise<boolean>;
  redeemPromoCode: (code: string) => Promise<boolean>;
};

const DeviceAuthContext = createContext<DeviceAuthContextType | undefined>(undefined);

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_REDESIGN_CREDITS = 1; // Gift from onboarding

export const DeviceAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceUUID, setDeviceUUID] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [redesignCredits, setRedesignCredits] = useState<number>(DEFAULT_REDESIGN_CREDITS);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);

  // Superwall user management (identify, set attributes, subscription status)
  // Store in refs to avoid retriggering the init useEffect when these change reference
  const { identify: superwallIdentify, update: superwallUpdate } = useUser();
  const { setSubscriptionStatus: swSetSubStatus } = useSuperwall();
  const superwallIdentifyRef = useRef(superwallIdentify);
  const superwallUpdateRef = useRef(superwallUpdate);
  const swSetSubStatusRef = useRef(swSetSubStatus);
  superwallIdentifyRef.current = superwallIdentify;
  superwallUpdateRef.current = superwallUpdate;
  swSetSubStatusRef.current = swSetSubStatus;

  // Sync subscription status to Superwall so audience filters work
  const syncSuperwallSubscriptionStatus = useCallback(async (premium: boolean) => {
    try {
      const swStatus = premium
        ? { status: 'ACTIVE' as const, entitlements: [{ id: 'pro' }] }
        : { status: 'INACTIVE' as const };
      console.log('[DeviceAuth] Setting Superwall subscription status:', JSON.stringify(swStatus));
      await swSetSubStatusRef.current(swStatus);
      console.log('[DeviceAuth] Superwall subscription status set:', premium ? 'ACTIVE' : 'INACTIVE');
    } catch (e) {
      console.warn('[DeviceAuth] Failed to set Superwall subscription status:', e);
    }
  }, []);

  // Update state from RevenueCat CustomerInfo
  const updateFromCustomerInfo = useCallback((customerInfo: CustomerInfo) => {
    const status = extractPremiumStatus(customerInfo);
    setIsPremium(status.isPremium);
    setExpirationDate(status.expirationDate);
    setSubscriptionType(getSubscriptionType(status.productIdentifier));
    syncSuperwallSubscriptionStatus(status.isPremium);

    console.log('[DeviceAuth] Premium status updated:', status.isPremium, status.productIdentifier);
  }, [syncSuperwallSubscriptionStatus]);

  // Sync premium status to Supabase (for analytics/backup)
  const syncToSupabase = useCallback(async (
    uuid: string,
    premium: boolean,
    subType: SubscriptionType,
    productId: string | null
  ) => {
    try {
      const plan = premium ? (subType || 'yearly') : 'free';
      await updateSubscription(uuid, premium, plan);
      console.log('[DeviceAuth] Synced subscription status to Supabase:', { premium, plan, productId });
    } catch (e) {
      console.warn('[DeviceAuth] Failed to sync to Supabase:', e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let removeListener: (() => void) | null = null;

    (async () => {
      let uuid: string | null = null;
      try {
        // Get or create device UUID
        uuid = await SecureStore.getItemAsync('deviceUUID');
        if (!uuid) {
          uuid = generateUuid();
          await SecureStore.setItemAsync('deviceUUID', uuid);
        }

        if (!mounted) return;
        setDeviceUUID(uuid);

        // Log device to Supabase
        try {
          await logDevice(uuid);
        } catch (e) {
          console.warn('[DeviceAuth] Failed to log device to Supabase:', e);
        }

        // Get local scan count
        const raw = await AsyncStorage.getItem(`scan_count:${uuid}`);
        const count = raw ? parseInt(raw, 10) : 0;
        if (!mounted) return;
        setScanCount(Number.isNaN(count) ? 0 : count);

        // Get local redesign credits (defaults to 1 if never set)
        const redesignRaw = await AsyncStorage.getItem(`redesign_credits:${uuid}`);
        if (redesignRaw !== null) {
          const credits = parseInt(redesignRaw, 10);
          if (!mounted) return;
          setRedesignCredits(Number.isNaN(credits) ? DEFAULT_REDESIGN_CREDITS : credits);
        }

        // Configure RevenueCat with device UUID as user ID
        await configureRevenueCat(uuid);
        await setRevenueCatUserID(uuid);

        // Identify user in Superwall (links Stripe metadata to device UUID)
        try {
          await superwallIdentifyRef.current(uuid);
          console.log('[DeviceAuth] User identified in Superwall:', uuid);
        } catch (swErr) {
          console.warn('[DeviceAuth] Failed to identify user in Superwall:', swErr);
        }

        // Fetch user email from Supabase and set Superwall user attributes
        try {
          const userData = await getUser(uuid);
          if (mounted && userData?.email) {
            setEmail(userData.email);
            // Pre-fill Stripe checkout form with user email
            await superwallUpdateRef.current((attrs) => ({
              ...attrs,
              email: userData.email,
            }));
            console.log('[DeviceAuth] Superwall user attributes set with email:', userData.email);
          }
        } catch (attrErr) {
          console.warn('[DeviceAuth] Failed to set Superwall user attributes:', attrErr);
        }

        console.log('[DeviceAuth] User ID synced to RevenueCat:', uuid);

        // SYNC: Fetch latest stats from backend (Source of Truth) to overwrite local if needed
        const raterUrl = process.env.EXPO_PUBLIC_RATER_URL;
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

        // Try Edge Function URL first, fallback to old raterUrl logic
        const apiUrl = process.env.EXPO_PUBLIC_API_URL
          ? process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '')
          : (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/api` : null);

        if (apiUrl || raterUrl) {
          try {
            const endpoint = apiUrl
              ? `${apiUrl}/user/stats/${uuid}`
              : `${raterUrl!.replace(/\/+$/, '')}/user/stats/${uuid}`;

            // @ts-ignore - access internal config for the anon key
            const supabaseAnonKey = supabase.supabaseKey;

            const res = await fetch(endpoint, {
              headers: {
                'ngrok-skip-browser-warning': 'true',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`
              }
            });
            if (res.ok) {
              const stats = await res.json();
              if (mounted) {
                setScanCount(stats.scan_count ?? count);
                
                // For redesign credits, take the MAX of local and backend
                // This prevents losing optimistic credits when webhook hasn't processed yet
                const localCredits = redesignRaw ? parseInt(redesignRaw, 10) : DEFAULT_REDESIGN_CREDITS;
                const backendCredits = stats.redesign_credits ?? localCredits;
                const finalCredits = Math.max(localCredits, backendCredits);
                setRedesignCredits(finalCredits);
                
                console.log('[DeviceAuth] Synced stats from backend:', stats, 'local:', localCredits, 'using:', finalCredits);

                // Update local storage to match the final value
                await AsyncStorage.setItem(`scan_count:${uuid}`, String(stats.scan_count ?? count));
                await AsyncStorage.setItem(`redesign_credits:${uuid}`, String(finalCredits));
              }
            }
          } catch (syncErr) {
            console.warn('[DeviceAuth] Failed to sync stats from backend:', syncErr);
          }
        }

        // Check initial premium status from RevenueCat
        const status = await checkPremiumStatus();
        if (!mounted) return;

        setIsPremium(status.isPremium);
        setExpirationDate(status.expirationDate);
        setSubscriptionType(getSubscriptionType(status.productIdentifier));

        // Tell Superwall about subscription status so audience filters work
        syncSuperwallSubscriptionStatus(status.isPremium);

        // Sync to Supabase (best-effort; keeps backend analytics/backup in sync)
        await syncToSupabase(uuid, status.isPremium, getSubscriptionType(status.productIdentifier), status.productIdentifier);

        // Listen for subscription updates (renewals, cancellations, etc.)
        addCustomerInfoUpdateListener((customerInfo) => {
          if (!mounted || !uuid) return;
          updateFromCustomerInfo(customerInfo);

          // Sync changes to Supabase
          const newStatus = extractPremiumStatus(customerInfo);
          syncToSupabase(uuid, newStatus.isPremium, getSubscriptionType(newStatus.productIdentifier), newStatus.productIdentifier);
        }).then(cleanup => {
          if (cleanup) removeListener = cleanup;
        });

      } catch (e) {
        console.warn('[DeviceAuth] Init error:', e);

        // Fallback: Check Supabase if RevenueCat fails
        const fallbackUuid = uuid || deviceUUID;
        if (mounted && fallbackUuid) {
          try {
            const user = await getUser(fallbackUuid);
            if (user && user.is_premium) {
              setIsPremium(true);
            }
          } catch (err) {
            console.warn('[DeviceAuth] Supabase fallback failed:', err);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (removeListener) removeListener();
    };
  }, [updateFromCustomerInfo, syncToSupabase]);

  const incrementScanCount = useCallback(async () => {
    if (!deviceUUID) throw new Error('No deviceUUID available');
    const newCount = scanCount + 1;
    try {
      await AsyncStorage.setItem(`scan_count:${deviceUUID}`, String(newCount));
    } catch (e) {
      console.warn('[DeviceAuth] incrementScanCount error:', e);
    }
    // Always update in-memory state so paywall gating can't be bypassed if storage write fails.
    setScanCount(newCount);
    return newCount;
  }, [deviceUUID, scanCount]);

  const useRedesignCredit = useCallback(async () => {
    if (!deviceUUID) throw new Error('No deviceUUID available');
    if (redesignCredits <= 0 && !isPremium) {
      throw new Error('No redesign credits available');
    }
    // Premium users get monthly credits (backend handles allocation)
    if (isPremium) {
      return redesignCredits;
    }
    const newCredits = redesignCredits - 1;
    try {
      await AsyncStorage.setItem(`redesign_credits:${deviceUUID}`, String(newCredits));
      console.log('[DeviceAuth] Redesign credit used, remaining:', newCredits);
    } catch (e) {
      console.warn('[DeviceAuth] useRedesignCredit error:', e);
    }
    // Always update in-memory state even if storage write fails.
    setRedesignCredits(newCredits);
    return newCredits;
  }, [deviceUUID, redesignCredits, isPremium]);

  const refundRedesignCredit = useCallback(async () => {
    if (!deviceUUID) throw new Error('No deviceUUID available');
    // Premium users don't need local refunds (backend handles credits)
    if (isPremium) {
      return redesignCredits;
    }
    const newCredits = redesignCredits + 1;
    try {
      await AsyncStorage.setItem(`redesign_credits:${deviceUUID}`, String(newCredits));
      console.log('[DeviceAuth] Redesign credit refunded, total:', newCredits);
    } catch (e) {
      console.warn('[DeviceAuth] refundRedesignCredit error:', e);
    }
    setRedesignCredits(newCredits);
    return newCredits;
  }, [deviceUUID, redesignCredits, isPremium]);

  const resetTrial = useCallback(async () => {
    if (!deviceUUID) return;
    try {
      // Reset scan count locally
      await AsyncStorage.setItem(`scan_count:${deviceUUID}`, '0');
      setScanCount(0);
      // Reset redesign credits back to default locally
      await AsyncStorage.setItem(`redesign_credits:${deviceUUID}`, String(DEFAULT_REDESIGN_CREDITS));
      setRedesignCredits(DEFAULT_REDESIGN_CREDITS);

      // Update Supabase directly
      const { supabase } = await import('./supabase');
      const { error } = await supabase
        .from('users')
        .update({
          scan_count: 0,
          redesign_credits: DEFAULT_REDESIGN_CREDITS,
          updated_at: new Date().toISOString()
        })
        .eq('device_uuid', deviceUUID);

      if (error) {
        console.warn('[DeviceAuth] Failed to reset in Supabase:', error);
      } else {
        console.log('[DeviceAuth] Supabase reset successful');
      }

      console.log('[DeviceAuth] Trial reset: scans=0, redesign credits=', DEFAULT_REDESIGN_CREDITS);
    } catch (e) {
      console.warn('[DeviceAuth] resetTrial error:', e);
    }
  }, [deviceUUID]);

  const addRedesignCredit = useCallback(async (amount: number) => {
    // Immediately update state (UI animation is handled separately in rate.tsx)
    setRedesignCredits(prev => prev + amount);

    // Persist to AsyncStorage for local backup
    if (deviceUUID) {
      const current = await AsyncStorage.getItem(`redesign_credits:${deviceUUID}`);
      const newVal = (current ? parseInt(current, 10) : 0) + amount;
      await AsyncStorage.setItem(`redesign_credits:${deviceUUID}`, String(newVal));
      console.log('[DeviceAuth] Credits added optimistically:', amount, 'new total:', newVal);
    }
  }, [deviceUUID]);

  const refreshPremiumStatus = useCallback(async () => {
    try {
      const status = await checkPremiumStatus();
      setIsPremium(status.isPremium);
      setExpirationDate(status.expirationDate);
      setSubscriptionType(getSubscriptionType(status.productIdentifier));
      syncSuperwallSubscriptionStatus(status.isPremium);
      if (deviceUUID) {
        await syncToSupabase(deviceUUID, status.isPremium, getSubscriptionType(status.productIdentifier), status.productIdentifier);

        // Also sync credits and scan count from backend after subscription update
        const raterUrl = process.env.EXPO_PUBLIC_RATER_URL;
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

        const apiUrl = process.env.EXPO_PUBLIC_API_URL
          ? process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '')
          : (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/api` : null);

        if (apiUrl || raterUrl) {
          try {
            const endpoint = apiUrl
              ? `${apiUrl}/user/stats/${deviceUUID}`
              : `${raterUrl!.replace(/\/+$/, '')}/user/stats/${deviceUUID}`;

            // @ts-ignore - access internal config for the anon key
            const supabaseAnonKey = supabase.supabaseKey;

            const res = await fetch(endpoint, {
              headers: {
                'ngrok-skip-browser-warning': 'true',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`
              }
            });
            if (res.ok) {
              const stats = await res.json();
              setScanCount(stats.scan_count ?? 0);
              
              // For redesign credits, take the MAX of current local and backend
              // This prevents losing optimistic credits when webhook hasn't processed yet
              const backendCredits = stats.redesign_credits ?? DEFAULT_REDESIGN_CREDITS;
              setRedesignCredits(currentCredits => {
                const finalCredits = Math.max(currentCredits, backendCredits);
                console.log('[DeviceAuth] Synced stats after premium refresh:', stats, 'local:', currentCredits, 'using:', finalCredits);
                
                // Also update AsyncStorage with the final value
                if (deviceUUID) {
                  AsyncStorage.setItem(`redesign_credits:${deviceUUID}`, String(finalCredits));
                }
                return finalCredits;
              });
              
            }
          } catch (syncErr) {
            console.warn('[DeviceAuth] Failed to sync stats after premium refresh:', syncErr);
          }
        }
      }
    } catch (e) {
      console.warn('[DeviceAuth] Error refreshing premium status:', e);
    }
  }, [deviceUUID, syncToSupabase, syncSuperwallSubscriptionStatus]);

  const restoreSubscription = useCallback(async (): Promise<boolean> => {
    try {
      const status = await restorePurchases();
      setIsPremium(status.isPremium);
      setExpirationDate(status.expirationDate);
      setSubscriptionType(getSubscriptionType(status.productIdentifier));

      // Sync to Supabase
      if (status.isPremium && deviceUUID) {
        await syncToSupabase(deviceUUID, true, getSubscriptionType(status.productIdentifier), status.productIdentifier);
      } else if (deviceUUID) {
        await syncToSupabase(deviceUUID, false, null, status.productIdentifier);
      }

      return status.isPremium;
    } catch (e) {
      console.warn('[DeviceAuth] Error restoring subscription:', e);
      return false;
    }
  }, [deviceUUID, syncToSupabase]);

  const linkAccount = useCallback(async (data: { email?: string; apple_id?: string; google_id?: string }) => {
    if (!deviceUUID) return false;
    const success = await linkUser(deviceUUID, data);
    // Update local email state and Superwall attributes when account is linked
    if (success && data.email) {
      setEmail(data.email);
      try {
        await superwallUpdateRef.current((attrs) => ({
          ...attrs,
          email: data.email,
        }));
        console.log('[DeviceAuth] Superwall attributes updated with linked email:', data.email);
      } catch (swErr) {
        console.warn('[DeviceAuth] Failed to update Superwall attributes on link:', swErr);
      }
    }
    return success;
  }, [deviceUUID]);

  const REVIEW_PROMO_CODE = 'APPLE_REVIEW_2026';

  const redeemPromoCode = useCallback(async (code: string): Promise<boolean> => {
    if (code.trim().toUpperCase() !== REVIEW_PROMO_CODE) {
      return false;
    }

    // Grant pro access locally
    setIsPremium(true);
    setSubscriptionType('yearly');

    // Sync to Superwall
    await syncSuperwallSubscriptionStatus(true);

    // Grant redesign credits
    await addRedesignCredit(99);

    // Sync to Supabase
    if (deviceUUID) {
      await syncToSupabase(deviceUUID, true, 'yearly', 'promo_code');
    }

    return true;
  }, [deviceUUID, syncToSupabase, syncSuperwallSubscriptionStatus, addRedesignCredit]);

  // User can scan if: still loading, OR is premium, OR has free scans left
  const canScan = loading || isPremium || scanCount < 3;

  // User can redesign if: is premium OR has redesign credits
  const canRedesign = isPremium || redesignCredits > 0;

  // Debug logging
  console.log('[DeviceAuth] Status:', {
    loading,
    isPremium,
    scanCount,
    canScan,
    redesignCredits,
    canRedesign,
    subscriptionType
  });

  return (
    <DeviceAuthContext.Provider
      value={{
        deviceUUID,
        email,
        scanCount,
        redesignCredits,
        loading,
        canScan,
        canRedesign,
        isPremium,
        subscriptionType,
        expirationDate,
        incrementScanCount,
        useRedesignCredit,
        addRedesignCredit,
        refundRedesignCredit,
        resetTrial,
        refreshPremiumStatus,
        restoreSubscription,
        linkAccount,
        redeemPromoCode
      }}
    >
      {children}
    </DeviceAuthContext.Provider>
  );
};

export const useDeviceAuth = () => {
  const ctx = useContext(DeviceAuthContext);
  if (!ctx) throw new Error('useDeviceAuth must be used within DeviceAuthProvider');
  return ctx;
};
