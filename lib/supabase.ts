import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function formatSupabaseError(err: any): string {
  try {
    if (!err) return 'Unknown error (empty error object)';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return `${err.name}: ${err.message}`;

    const code = err.code ? String(err.code) : '';
    const message = err.message ? String(err.message) : '';
    const details = err.details ? String(err.details) : '';
    const hint = err.hint ? String(err.hint) : '';

    // Supabase/PostgREST errors are usually plain objects; stringify so Expo logs show them.
    const json = JSON.stringify(err);
    const pieces = [
      code ? `code=${code}` : '',
      message ? `message=${message}` : '',
      details ? `details=${details}` : '',
      hint ? `hint=${hint}` : '',
      json ? `raw=${json}` : ''
    ].filter(Boolean);

    return pieces.length ? pieces.join(' | ') : 'Unknown error (unrecognized shape)';
  } catch {
    return 'Unknown error (failed to format error)';
  }
}

function maybeHelpfulHint(err: any): string | null {
  const msg = (err?.message ? String(err.message) : '').toLowerCase();
  const code = err?.code ? String(err.code) : '';

  if (code === '42P01' || msg.includes('relation') && msg.includes('does not exist')) {
    return 'Hint: Your Supabase table `users` likely does not exist. Run `backend/supabase_migration.sql` in Supabase → SQL Editor.';
  }
  if (code === '42703' || msg.includes('column') && msg.includes('does not exist')) {
    return 'Hint: Your `users` table schema is missing columns the app expects (like `plan`, `email`, `apple_id`). Re-run the updated `backend/supabase_migration.sql` (it adds missing columns).';
  }
  if (code === '42501' || msg.includes('permission denied') || msg.includes('row-level security')) {
    return 'Hint: RLS/permissions are blocking access. Ensure RLS policies allow anon inserts/selects for `users` (or disable RLS for MVP).';
  }
  if (msg.includes('only absolute urls are supported') || msg.includes('failed to fetch') || msg.includes('network request failed')) {
    return 'Hint: Supabase URL/key may be missing/invalid. Ensure you created a root `.env` with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.';
  }

  return null;
}

// Types for subscription data matching the DB schema
export type SubscriptionType = 'weekly' | 'monthly' | 'yearly';

export interface UserData {
  id: string;
  created_at: string;
  device_uuid: string;
  scan_count: number;
  is_premium: boolean;
  apple_id: string | null;
  google_id: string | null;
  email: string | null;
  updated_at: string;
  plan: string | null; // 'free', 'weekly', 'monthly', 'yearly'
  redesign_credits: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  payment_platform: string | null; // 'iap' or 'stripe'
}

/**
 * Log device on startup. Inserts if not exists.
 */
export async function logDevice(deviceUUID: string): Promise<UserData | null> {
  try {
    if (!isSupabaseConfigured()) {
      // Avoid noisy network errors when env vars aren't set (common during local setup).
      console.warn('[Supabase] logDevice skipped (missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)');
      return null;
    }

    // Try to select first to see if it exists
    const { data: existing, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('device_uuid', deviceUUID)
      .maybeSingle();

    if (selectError) {
      const hint = maybeHelpfulHint(selectError);
      console.warn('[Supabase] Error selecting device row:', formatSupabaseError(selectError));
      if (hint) console.warn(hint);
      return null;
    }

    if (existing) {
      return existing as UserData;
    }

    // If not exists, insert
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          device_uuid: deviceUUID,
          scan_count: 0,
          is_premium: false,
          plan: 'free',
          redesign_credits: 1 // Gift from onboarding
        }
      ])
      .select()
      .single();

    if (error) {
      // Handle race condition where it might have been created in parallel
      if (error.code === '23505') { // Unique violation
        const { data: retryData } = await supabase
          .from('users')
          .select('*')
          .eq('device_uuid', deviceUUID)
          .single();
        return retryData as UserData;
      }
      const hint = maybeHelpfulHint(error);
      console.warn('[Supabase] Error logging device:', formatSupabaseError(error));
      if (hint) console.warn(hint);
      return null;
    }

    return data as UserData;
  } catch (e) {
    console.warn('[Supabase] Exception logging device:', formatSupabaseError(e));
    return null;
  }
}

/**
 * Sync subscription status from RevenueCat to database.
 * NOTE: This does NOT grant credits - credits are only granted by the webhook.
 */
export async function updateSubscription(
  deviceUUID: string,
  isPremium: boolean,
  plan: string | null
): Promise<boolean> {
  try {
    if (!isSupabaseConfigured()) {
      console.warn('[Supabase] updateSubscription skipped (missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)');
      return false;
    }

    // NOTE: Do NOT grant credits here!
    // Credits are ONLY granted by the webhook (which has transaction deduplication).
    // This function just syncs the premium status from RevenueCat.

    const { error } = await supabase
      .from('users')
      .update({
        is_premium: isPremium,
        plan: plan,
        updated_at: new Date().toISOString()
      })
      .eq('device_uuid', deviceUUID);

    if (error) {
      const hint = maybeHelpfulHint(error);
      console.warn('[Supabase] Error updating subscription:', formatSupabaseError(error));
      if (hint) console.warn(hint);
      return false;
    }

    console.log(`[Supabase] Subscription synced: premium=${isPremium}, plan=${plan}`);
    return true;
  } catch (e) {
    console.warn('[Supabase] Exception updating subscription:', formatSupabaseError(e));
    return false;
  }
}

/**
 * Link authenticated user to device
 */
export async function linkUser(
  deviceUUID: string,
  updates: { email?: string; apple_id?: string; google_id?: string }
): Promise<boolean> {
  try {
    if (!isSupabaseConfigured()) {
      console.warn('[Supabase] linkUser skipped (missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)');
      return false;
    }

    const { error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('device_uuid', deviceUUID);

    if (error) {
      const hint = maybeHelpfulHint(error);
      console.warn('[Supabase] Error linking user:', formatSupabaseError(error));
      if (hint) console.warn(hint);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Supabase] Exception linking user:', formatSupabaseError(e));
    return false;
  }
}

/**
 * Get user data
 */
export async function getUser(deviceUUID: string): Promise<UserData | null> {
  try {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('device_uuid', deviceUUID)
      .single();

    if (error) {
      // Avoid spamming logs for optional reads; return null.
      return null;
    }
    return data as UserData;
  } catch (e) {
    return null;
  }
}

