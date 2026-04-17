import { Platform } from 'react-native';

// RevenueCat API keys from dashboard
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

// Your entitlement ID from RevenueCat dashboard (must match exactly)
export const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';

// Lazy load Purchases to avoid crash on import
let Purchases: typeof import('react-native-purchases').default | null = null;
let LOG_LEVEL: typeof import('react-native-purchases').LOG_LEVEL | null = null;

async function getPurchases() {
  if (!Purchases) {
    try {
      const module = await import('react-native-purchases');
      Purchases = module.default;
      LOG_LEVEL = module.LOG_LEVEL;
    } catch (e) {
      console.warn('[RevenueCat] Failed to load module:', e);
      return null;
    }
  }
  return Purchases;
}

// Re-export types for use elsewhere
export type { CustomerInfo, PurchasesOffering } from 'react-native-purchases';

let isConfigured = false;

/**
 * Initialize RevenueCat SDK
 * Call this once when app starts (in _layout.tsx)
 */
export async function configureRevenueCat(appUserID?: string): Promise<void> {
  if (isConfigured) {
    console.log('[RevenueCat] Already configured');
    return;
  }

  const purchases = await getPurchases();
  if (!purchases || !LOG_LEVEL) {
    console.warn('[RevenueCat] Module not available');
    return;
  }

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn('[RevenueCat] API key not set for platform:', Platform.OS);
    return;
  }

  if (apiKey.startsWith('test_')) {
    console.warn(
      '[RevenueCat] You are using a placeholder/test SDK key. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY in your root .env and restart Expo.',
    );
    // Still allow configuration (some teams intentionally use test keys), but this is almost always a misconfig.
  }

  try {
    // Enable verbose logs for debugging (can change to DEBUG or INFO in production)
    purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO);

    // Configure with platform-specific API key and optional app user ID
    await purchases.configure({
      apiKey,
      appUserID: appUserID || undefined, // If undefined, RevenueCat generates anonymous ID
    });

    isConfigured = true;
    console.log('[RevenueCat] Configured successfully');
  } catch (error) {
    console.error('[RevenueCat] Configuration error:', error);
  }
}

/**
 * Set the app user ID (call after getting device UUID)
 */
export async function setRevenueCatUserID(userID: string): Promise<void> {
  const purchases = await getPurchases();
  if (!purchases) return;

  try {
    await purchases.logIn(userID);
    console.log('[RevenueCat] User ID set:', userID);
  } catch (error) {
    console.error('[RevenueCat] Error setting user ID:', error);
  }
}

/**
 * Check if user has active premium entitlement
 */
export async function checkPremiumStatus(): Promise<{
  isPremium: boolean;
  expirationDate: string | null;
  productIdentifier: string | null;
}> {
  const purchases = await getPurchases();
  if (!purchases) {
    return { isPremium: false, expirationDate: null, productIdentifier: null };
  }

  try {
    const customerInfo = await purchases.getCustomerInfo();
    return extractPremiumStatus(customerInfo);
  } catch (error) {
    console.error('[RevenueCat] Error checking premium status:', error);
    return { isPremium: false, expirationDate: null, productIdentifier: null };
  }
}

/**
 * Extract premium status from CustomerInfo
 */
export function extractPremiumStatus(customerInfo: any): {
  isPremium: boolean;
  expirationDate: string | null;
  productIdentifier: string | null;
} {
  if (!customerInfo) {
    return { isPremium: false, expirationDate: null, productIdentifier: null };
  }

  // Debug: Log what we're seeing
  console.log('[RevenueCat] Checking entitlements:', {
    entitlementId: ENTITLEMENT_ID,
    activeEntitlements: Object.keys(customerInfo.entitlements?.active || {}),
    activeSubscriptions: customerInfo.activeSubscriptions,
  });

  // First, try to find the entitlement by ID
  const entitlement = customerInfo.entitlements?.active?.[ENTITLEMENT_ID];

  if (entitlement) {
    console.log('[RevenueCat] Found entitlement:', ENTITLEMENT_ID);
    return {
      isPremium: true,
      expirationDate: entitlement.expirationDate || null,
      productIdentifier: entitlement.productIdentifier || null,
    };
  }

  // Fallback: Check if there are ANY active entitlements (in case entitlement ID is misconfigured)
  const activeEntitlementKeys = Object.keys(customerInfo.entitlements?.active || {});
  if (activeEntitlementKeys.length > 0) {
    const firstEntitlement = customerInfo.entitlements.active[activeEntitlementKeys[0]];
    console.log('[RevenueCat] Found different entitlement:', activeEntitlementKeys[0]);
    return {
      isPremium: true,
      expirationDate: firstEntitlement.expirationDate || null,
      productIdentifier: firstEntitlement.productIdentifier || null,
    };
  }

  // Fallback: Check activeSubscriptions array (works even without entitlements configured)
  const activeSubscriptions = customerInfo.activeSubscriptions || [];
  if (activeSubscriptions.length > 0) {
    const productId = activeSubscriptions[0];
    console.log('[RevenueCat] Found active subscription (no entitlement):', productId);
    return {
      isPremium: true,
      expirationDate: null, // Not available without entitlement
      productIdentifier: productId,
    };
  }

  console.log('[RevenueCat] No premium status found');
  return { isPremium: false, expirationDate: null, productIdentifier: null };
}

/**
 * Get available offerings (subscription options)
 */
export async function getOfferings(): Promise<any | null> {
  const purchases = await getPurchases();
  if (!purchases) return null;

  try {
    const offerings = await purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error('[RevenueCat] Error getting offerings:', error);
    return null;
  }
}

/**
 * Restore purchases (useful when user reinstalls or switches devices)
 */
export async function restorePurchases(): Promise<{
  isPremium: boolean;
  expirationDate: string | null;
  productIdentifier: string | null;
}> {
  const purchases = await getPurchases();
  if (!purchases) {
    return { isPremium: false, expirationDate: null, productIdentifier: null };
  }

  try {
    const customerInfo = await purchases.restorePurchases();
    console.log('[RevenueCat] Purchases restored');
    return extractPremiumStatus(customerInfo);
  } catch (error) {
    console.error('[RevenueCat] Error restoring purchases:', error);
    return { isPremium: false, expirationDate: null, productIdentifier: null };
  }
}

/**
 * Add listener for customer info updates (subscription changes)
 * Returns a cleanup function, or null if RevenueCat isn't available
 */
export async function addCustomerInfoUpdateListener(
  callback: (info: any) => void
): Promise<(() => void) | null> {
  const purchases = await getPurchases();
  if (!purchases) return null;

  try {
    // addCustomerInfoUpdateListener might return void or an object with remove method
    const listener = purchases.addCustomerInfoUpdateListener(callback) as any;
    return () => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    };
  } catch (e) {
    console.warn('[RevenueCat] Failed to add listener:', e);
    return null;
  }
}

/**
 * Get subscription type from product ID
 */
export function getSubscriptionType(productId: string | null): 'weekly' | 'monthly' | 'yearly' | null {
  if (!productId) return null;
  if (productId.includes('weekly')) return 'weekly';
  if (productId.includes('monthly')) return 'monthly';
  if (productId.includes('yearly')) return 'yearly';
  return 'yearly'; // Default
}

/**
 * Force sync purchases with RevenueCat
 * Call this after a Superwall purchase to ensure RevenueCat picks it up
 */
export async function syncPurchases(): Promise<void> {
  const purchases = await getPurchases();
  if (!purchases) return;  try {
    // syncPurchases forces RevenueCat to check with the App Store for any purchases
    // that might not have been recorded (e.g., from Superwall)
    await purchases.syncPurchases();
    console.log('[RevenueCat] Purchases synced successfully');
  } catch (error) {
    console.error('[RevenueCat] Error syncing purchases:', error);
  }
}
