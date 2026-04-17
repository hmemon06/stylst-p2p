import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROFILE_STORAGE_KEY = 'stylst_ai_profile';

export type PersistedProfile = Record<string, unknown>;

/**
 * Loads the persisted style profile captured during onboarding. If parsing fails, returns null.
 */
export async function loadPersistedProfile(): Promise<PersistedProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as PersistedProfile;
    }
  } catch (error) {
    console.warn('[profile] Failed to load persisted profile', error);
  }
  return null;
  return null;
}

/**
 * Save profile changes to storage.
 */
export async function savePersistedProfile(profile: PersistedProfile): Promise<boolean> {
  try {
    const raw = JSON.stringify(profile);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, raw);
    return true;
  } catch (error) {
    console.warn('[profile] Failed to save profile', error);
    return false;
  }
}
