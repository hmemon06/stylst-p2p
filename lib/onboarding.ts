import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingData } from './onboardingContext';
import { PROFILE_STORAGE_KEY } from './profile';

const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
const ONBOARDING_DATA_KEY = 'onboarding_data';

export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
}

export async function markOnboardingCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  } catch (error) {
    console.error('Error marking onboarding as completed:', error);
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    await AsyncStorage.removeItem(ONBOARDING_DATA_KEY);
    await AsyncStorage.removeItem(PROFILE_STORAGE_KEY); // Also clear profile
  } catch (error) {
    // Ignore AsyncStorage deletion errors - they're common on iOS
    // and don't affect functionality since we're just clearing keys
    console.warn('AsyncStorage cleanup warning (safe to ignore):', error);
  }
}

export async function saveOnboardingData(data: OnboardingData): Promise<void> {
  try {
    // Save to onboarding_data key for app state
    await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(data));
    // ALSO save to stylst_ai_profile key so the AI can use it
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving onboarding data:', error);
  }
}

export async function getOnboardingData(): Promise<OnboardingData | null> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Error getting onboarding data:', error);
    return null;
  }
}
