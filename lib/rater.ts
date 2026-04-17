import { supabase } from './supabase';

export type RatingAspectKey = 'aura' | 'fit' | 'palette' | 'trend';

export type RatingSubscore = {
  key: RatingAspectKey;
  label: string;
  score: number; // 0-100
  insight: string;
};

export type RatingResult = {
  overall: {
    score: number; // 0-100
    label: string; // "OFFICE DRONE CORE"
  };
  compliment: string; // "The W"
  critique: string; // "The L"
  redesign_prompt?: string; // Prompt for Seedream AI image generation
  potential_score?: number;
  score_justification?: string; // Thorough explanation of why the score is what it is
  original_image_url?: string; // Supabase URL for the original image
  outfit_id?: string; // ID for history tracking
  subscores: RatingSubscore[]; // Exactly four items
};

export type RateOutfitOptions = {
  /** Persisted onboarding profile to include with the rating request. */
  profile?: Record<string, unknown> | null;
  /** Context tag for the outfit (e.g. "Date", "Office"). */
  context?: string;
  /** Optional abort signal for cancelling in-flight requests. */
  signal?: AbortSignal;
  /** Device UUID to link images with device. */
  deviceUUID?: string;
};

// ...

// ===================================
// NEW ASYNC REDESIGN METHODS
// ===================================

/**
 * Start an asynchronous redesign job (Fire-and-forget)
 */

export type RateRedesignOptions = {
  /** The fix that was supposedly applied to the outfit. */
  redesignFix: string;
  /** The original score before the redesign. */
  originalScore: number;
  /** Persisted onboarding profile to include with the rating request. */
  profile?: Record<string, unknown> | null;
  /** Optional abort signal for cancelling in-flight requests. */
  signal?: AbortSignal;
};
// ===================================
// API CONFIGURATION
// ===================================

function getApiUrl(): string | null {
  // Priority 1: Direct API URL from env
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // Priority 2: Derive from Supabase URL (Edge Function)
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/api`;
  }

  // Priority 3: Fallback to old RATER_URL if it looks like a full API URL
  const raterUrl = process.env.EXPO_PUBLIC_RATER_URL;
  if (raterUrl && !raterUrl.endsWith('/rate')) {
    return raterUrl.replace(/\/+$/, '');
  }

  return null;
}

/**
 * Get the old /rate endpoint for backward compatibility or direct access
 */
function getRateEndpoint(): string | null {
  const apiUrl = getApiUrl();
  if (apiUrl) return `${apiUrl}/rate`;

  const raterUrl = process.env.EXPO_PUBLIC_RATER_URL;
  if (raterUrl) return raterUrl;

  return null;
}

function getHeaders(deviceUUID?: string) {
  const apiKey = resolveApiKey(process.env.EXPO_PUBLIC_RATER_API_KEY);
  // @ts-ignore - access internal config for the anon key
  const supabaseAnonKey = supabase.supabaseKey;

  return {
    'ngrok-skip-browser-warning': 'true',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    ...(apiKey ? { 'X-Rater-Api-Key': apiKey } : {}),
    ...(deviceUUID ? { 'x-device-uuid': deviceUUID } : {}),
  };
}

/**
 * Detect image file info from URI for proper FormData submission
 */
function getImageFileInfo(imageUri: string): { name: string; type: string } {
  const uriLower = imageUri.toLowerCase();

  // Check file extension from URI
  if (uriLower.includes('.heic') || uriLower.includes('.heif')) {
    return { name: 'outfit.heic', type: 'image/heic' };
  }
  if (uriLower.includes('.png')) {
    return { name: 'outfit.png', type: 'image/png' };
  }
  if (uriLower.includes('.gif')) {
    return { name: 'outfit.gif', type: 'image/gif' };
  }
  if (uriLower.includes('.webp')) {
    return { name: 'outfit.webp', type: 'image/webp' };
  }

  // Default to JPEG (most common for camera captures that don't have extension in URI)
  return { name: 'outfit.jpg', type: 'image/jpeg' };
}

export async function rateOutfit(imageUri: string, options: RateOutfitOptions = {}): Promise<RatingResult> {
  const endpoint = getRateEndpoint();
  const { profile, context, signal, deviceUUID } = options;

  if (!endpoint) {
    console.warn('[rater] No rating endpoint configured – returning mock score');
    await delay(1200);
    return createMockRating();
  }

  // Get correct file info for proper HEIC detection on server
  const fileInfo = getImageFileInfo(imageUri);
  console.log(`[rater] Detected image type: ${fileInfo.type} (from URI: ...${imageUri.slice(-30)})`);

  const form = new FormData();
  // @ts-expect-error - React Native FormData file type
  form.append('image', {
    uri: imageUri,
    name: fileInfo.name,
    type: fileInfo.type,
  });

  if (context) {
    form.append('context', context);
  }

  if (profile && hasSerializableContent(profile)) {
    try {
      const profileJson = JSON.stringify(profile);
      console.log('[rater] Sending profile to backend:', profileJson);
      form.append('profile', profileJson);
    } catch (error) {
      console.warn('[rater] Failed to serialize profile payload – proceeding without it.', error);
    }
  }

  let response: Response;
  try {
    console.log('[rater] Fetching:', endpoint);
    response = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(deviceUUID),
      body: form,
      signal,
    });
    console.log('[rater] Response received:', response.status);
  } catch (error: any) {
    console.error('[rater] Fetch error:', error?.message || error);
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new Error('Unable to reach the Stylst AI rating service. Please try again.');
  }

  const rawBody = await response.text();

  if (!response.ok) {
    const message = extractErrorMessage(rawBody) ?? `Rating request failed with status ${response.status}.`;
    console.warn('[rater] Non-OK response:', response.status, rawBody?.slice?.(0, 200) ?? rawBody);
    throw new Error(`[${response.status}] ${message}`);
  }

  if (!rawBody) {
    throw new Error('Stylst AI returned an empty response. Please try again.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    console.warn('[rater] Unable to parse rating response payload', error, rawBody);
    const message = extractErrorMessage(rawBody);
    throw new Error(message ?? 'Unexpected response format from the rating service.');
  }

  // Log redesign prompt and score justification if available
  const result = parsed as RatingResult;
  if (result?.redesign_prompt) {
    console.log(`[rater] 💡 Redesign Prompt: "${result.redesign_prompt.slice(0, 60)}..." -> Score: ${result.potential_score ?? 'N/A'}`);
  }
  if (result?.score_justification) {
    console.log(`[rater] 📊 Score Justification: "${result.score_justification}"`);
  }
  if (result?.original_image_url) {
    console.log(`[rater] 📸 Original image URL: ${result.original_image_url}`);
  }

  return normalizeRatingResult(parsed);
}

export function createMockRating(seed: string = 'demo'): RatingResult {
  return {
    overall: { score: 64, label: 'OFFICE DRONE CORE' },
    compliment: 'Shoulder fit is actually solid.',
    critique: 'The skinny jeans are dating you. Burn them.',
    redesign_prompt: 'Change the skinny jeans to wide-leg olive cargo pants. Keep everything else exactly the same.',
    potential_score: 82,
    subscores: [
      { key: 'aura', label: 'Aura', score: 32, insight: 'Low energy' },
      { key: 'fit', label: 'Fit', score: 45, insight: 'Too tight' },
      { key: 'palette', label: 'Palette', score: 88, insight: 'Good neutrals' },
      { key: 'trend', label: 'Trend', score: 20, insight: 'Outdated' },
    ],
  };
}

export function createMockRedesignRating(originalScore: number): RatingResult {
  // Generate an improved score based on original
  const improvedScore = Math.min(95, originalScore + 15 + Math.floor(Math.random() * 10));
  return {
    overall: { score: improvedScore, label: 'GLOW UP ACHIEVED' },
    compliment: 'The new look is way more cohesive.',
    critique: 'Could still use some accessories to elevate it further.',
    redesign_prompt: 'Add layered silver chain necklaces and a statement belt. Keep everything else exactly the same.',
    potential_score: Math.min(100, improvedScore + 8),
    subscores: [
      { key: 'aura', label: 'Aura', score: Math.min(95, originalScore + 20), insight: 'Much better vibe' },
      { key: 'fit', label: 'Fit', score: Math.min(95, originalScore + 18), insight: 'Silhouette improved' },
      { key: 'palette', label: 'Palette', score: Math.min(95, originalScore + 12), insight: 'Colors working' },
      { key: 'trend', label: 'Trend', score: Math.min(95, originalScore + 25), insight: 'On trend now' },
    ],
  };
}

/**
 * Rate an outfit as if a redesign fix was applied.
 * This calls the backend with redesign context so the AI rates 
 * the outfit AS IF the suggested change was made.
 */
export async function rateRedesign(
  imageUri: string,
  options: RateRedesignOptions
): Promise<RatingResult> {
  const endpoint = getRateEndpoint();
  const apiKey = resolveApiKey(process.env.EXPO_PUBLIC_RATER_API_KEY);
  const { redesignFix, originalScore, profile, signal } = options;

  if (!endpoint) {
    console.warn('[rater] No rating endpoint configured – returning mock redesign score');
    await delay(1500);
    return createMockRedesignRating(originalScore);
  }

  // Get correct file info for proper HEIC detection on server
  const fileInfo = getImageFileInfo(imageUri);

  const form = new FormData();
  // @ts-expect-error - React Native FormData file type
  form.append('image', {
    uri: imageUri,
    name: fileInfo.name,
    type: fileInfo.type,
  });

  // Add redesign context
  form.append('redesign', redesignFix);
  form.append('originalScore', String(originalScore));

  if (profile && hasSerializableContent(profile)) {
    try {
      const profileJson = JSON.stringify(profile);
      console.log('[rater] Sending profile for redesign:', profileJson);
      form.append('profile', profileJson);
    } catch (error) {
      console.warn('[rater] Failed to serialize profile payload – proceeding without it.', error);
    }
  }

  let response: Response;
  try {
    console.log('[rater] Fetching redesign rating:', endpoint);
    console.log('[rater] Redesign fix:', redesignFix);
    response = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(),
      body: form,
      signal,
    });
    console.log('[rater] Redesign response received:', response.status);
  } catch (error: any) {
    console.error('[rater] Redesign fetch error:', error?.message || error);
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new Error('Unable to reach the Stylst AI rating service. Please try again.');
  }

  const rawBody = await response.text();

  if (!response.ok) {
    const message = extractErrorMessage(rawBody) ?? `Redesign rating request failed with status ${response.status}.`;
    console.warn('[rater] Redesign non-OK response:', response.status, rawBody?.slice?.(0, 200) ?? rawBody);
    throw new Error(`[${response.status}] ${message}`);
  }

  if (!rawBody) {
    throw new Error('Stylst AI returned an empty response. Please try again.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    console.warn('[rater] Unable to parse redesign response payload', error, rawBody);
    const message = extractErrorMessage(rawBody);
    throw new Error(message ?? 'Unexpected response format from the rating service.');
  }

  // Log the redesign result
  const result = parsed as RatingResult;
  console.log(`[rater] ✨ Redesign complete! New score: ${result?.overall?.score}`);
  if (result?.redesign_prompt) {
    console.log(`[rater] 💡 Next redesign prompt: "${result.redesign_prompt.slice(0, 60)}..." -> Score: ${result.potential_score ?? 'N/A'}`);
  }

  return normalizeRatingResult(parsed);
}

/**
 * Generate a redesigned outfit image using Seedream 4.5 Edit.
 * Calls the backend /generate-redesign endpoint which handles the Seedream API.
 * @param imageUri - The original outfit image URI
 * @param redesignPrompt - The prompt describing what to change
 * @param signal - Optional abort signal
 * @returns The URL of the generated redesign image (hosted on Supabase)
 */
export async function generateRedesignImage(
  imageUri: string,
  redesignPrompt: string,
  deviceUUID?: string,
  signal?: AbortSignal
): Promise<string> {
  const apiUrl = getApiUrl();
  const baseEndpoint = resolveEndpoint(process.env.EXPO_PUBLIC_RATER_URL);

  // Try Edge Function URL first, then fallback to baseEndpoint replacement
  const endpoint = apiUrl
    ? `${apiUrl}/generate-redesign`
    : (baseEndpoint ? baseEndpoint.replace('/rate', '/generate-redesign') : null);

  if (!endpoint) {
    throw new Error('Backend URL not configured');
  }

  const apiKey = resolveApiKey(process.env.EXPO_PUBLIC_RATER_API_KEY);

  console.log('[rater] Generating redesign image...');
  console.log('[rater] Endpoint:', endpoint);
  console.log('[rater] Prompt:', redesignPrompt.slice(0, 80) + '...');

  // Get correct file info for proper HEIC detection on server
  const fileInfo = getImageFileInfo(imageUri);

  const form = new FormData();
  // @ts-expect-error - React Native FormData file type
  form.append('image', {
    uri: imageUri,
    name: fileInfo.name,
    type: fileInfo.type,
  });
  form.append('redesign_prompt', redesignPrompt);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(deviceUUID),
      body: form,
      signal,
    });
    console.log('[rater] Generate redesign response:', response.status);
  } catch (error: any) {
    console.error('[rater] Generate redesign fetch error:', error?.message || error);
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new Error('Unable to reach the redesign service. Please try again.');
  }

  const rawBody = await response.text();

  if (!response.ok) {
    const message = extractErrorMessage(rawBody) ?? `Redesign generation failed with status ${response.status}.`;
    console.warn('[rater] Generate redesign non-OK response:', response.status, rawBody?.slice?.(0, 200) ?? rawBody);
    throw new Error(`[${response.status}] ${message}`);
  }

  let parsed: { imageUrl?: string };
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    console.warn('[rater] Unable to parse generate redesign response', error, rawBody);
    throw new Error('Unexpected response format from the redesign service.');
  }

  if (!parsed.imageUrl) {
    throw new Error('Redesign service did not return an image URL');
  }

  console.log('[rater] ✨ Redesign image generated:', parsed.imageUrl);
  return parsed.imageUrl;
}

// ===================================
// ASYNC REDESIGN JOB METHODS (BACKEND)
// ===================================

export type RedesignJob = {
  id: string;
  status: string;
};

export type RedesignJobStatus = {
  id: string;
  status: string;
  redesign_image_url?: string | null;
};

function deriveBackendEndpoint(rateEndpoint: string, suffixPath: string): string {
  const suffix = suffixPath.startsWith('/') ? suffixPath : `/${suffixPath}`;
  const url = new URL(rateEndpoint);

  const pathname = url.pathname.replace(/\/+$/, '');
  const basePath = pathname === '/' ? '' : pathname;

  if (basePath.endsWith('/rate')) {
    url.pathname = `${basePath.slice(0, -'/rate'.length)}${suffix}` || suffix;
  } else {
    url.pathname = `${basePath}${suffix}` || suffix;
  }

  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * Create an asynchronous redesign job on the backend.
 * Backend route: POST /redesigns/create
 */
export async function createRedesignJob(
  outfitId: string,
  redesignPrompt: string,
  options: { deviceUUID?: string; signal?: AbortSignal } = {}
): Promise<RedesignJob> {
  const apiUrl = getApiUrl();
  const baseEndpoint = resolveEndpoint(process.env.EXPO_PUBLIC_RATER_URL);
  const apiKey = resolveApiKey(process.env.EXPO_PUBLIC_RATER_API_KEY);

  const endpoint = apiUrl
    ? `${apiUrl}/redesigns/create`
    : (baseEndpoint ? deriveBackendEndpoint(baseEndpoint, '/redesigns/create') : null);

  if (!endpoint) {
    throw new Error('Backend URL not configured');
  }

  if (!outfitId) {
    throw new Error('Missing outfit ID');
  }

  if (!redesignPrompt) {
    throw new Error('Missing redesign prompt');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...getHeaders(options.deviceUUID),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ outfit_id: outfitId, redesign_prompt: redesignPrompt }),
      signal: options.signal,
    });
  } catch (error: any) {
    console.error('[rater] createRedesignJob fetch error:', error?.message || error);
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new Error('Unable to reach the redesign service. Please try again.');
  }

  const rawBody = await response.text();

  if (!response.ok) {
    const message = extractErrorMessage(rawBody) ?? `Redesign job creation failed with status ${response.status}.`;
    console.warn('[rater] createRedesignJob non-OK response:', response.status, rawBody?.slice?.(0, 200) ?? rawBody);
    throw new Error(`[${response.status}] ${message}`);
  }

  let parsed: any;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    console.warn('[rater] Unable to parse createRedesignJob response', error, rawBody);
    throw new Error('Unexpected response format from the redesign service.');
  }

  const job = parsed?.data ?? parsed;
  if (!job?.id) {
    throw new Error('Redesign service did not return a job id');
  }

  return { id: String(job.id), status: String(job.status ?? 'pending') };
}

/**
 * Poll backend for redesign job status.
 * Backend route: GET /redesigns/status/:id
 */
export async function pollRedesignStatus(
  jobId: string,
  options: { deviceUUID?: string; signal?: AbortSignal } = {}
): Promise<RedesignJobStatus> {
  const apiUrl = getApiUrl();
  const baseEndpoint = resolveEndpoint(process.env.EXPO_PUBLIC_RATER_URL);
  const apiKey = resolveApiKey(process.env.EXPO_PUBLIC_RATER_API_KEY);

  const endpoint = apiUrl
    ? `${apiUrl}/redesigns/status/${encodeURIComponent(jobId)}`
    : (baseEndpoint ? deriveBackendEndpoint(baseEndpoint, `/redesigns/status/${encodeURIComponent(jobId)}`) : null);

  if (!endpoint) {
    throw new Error('Backend URL not configured');
  }

  if (!jobId) {
    throw new Error('Missing job id');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: getHeaders(options.deviceUUID),
      signal: options.signal,
    });
  } catch (error: any) {
    console.error('[rater] pollRedesignStatus fetch error:', error?.message || error);
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new Error('Unable to reach the redesign service. Please try again.');
  }

  const rawBody = await response.text();

  if (!response.ok) {
    const message = extractErrorMessage(rawBody) ?? `Redesign status request failed with status ${response.status}.`;
    console.warn('[rater] pollRedesignStatus non-OK response:', response.status, rawBody?.slice?.(0, 200) ?? rawBody);
    throw new Error(`[${response.status}] ${message}`);
  }

  let parsed: any;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    console.warn('[rater] Unable to parse pollRedesignStatus response', error, rawBody);
    throw new Error('Unexpected response format from the redesign service.');
  }

  if (!parsed?.id) {
    throw new Error('Redesign service did not return a status payload');
  }

  return {
    id: String(parsed.id),
    status: String(parsed.status ?? 'pending'),
    redesign_image_url: parsed.redesign_image_url ?? null,
  };
}

/**
 * Persist the redesign rating result onto the ORIGINAL outfit record so History can render
 * the correct pro/critique for the glow-up without re-rating.
 * Backend route: POST /redesigns/save-rating
 */
export async function saveRedesignRating(
  outfitId: string,
  redesignRating: RatingResult,
  redesignImageUrl?: string | null,
  options: { deviceUUID?: string; signal?: AbortSignal } = {},
): Promise<void> {
  const apiUrl = getApiUrl();
  const baseEndpoint = resolveEndpoint(process.env.EXPO_PUBLIC_RATER_URL);
  const apiKey = resolveApiKey(process.env.EXPO_PUBLIC_RATER_API_KEY);

  const endpoint = apiUrl
    ? `${apiUrl}/redesigns/save-rating`
    : (baseEndpoint ? deriveBackendEndpoint(baseEndpoint, '/redesigns/save-rating') : null);

  if (!endpoint) {
    throw new Error('Backend URL not configured');
  }
  if (!outfitId) {
    throw new Error('Missing outfit ID');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...getHeaders(options.deviceUUID),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outfit_id: outfitId,
        redesign_image_url: redesignImageUrl ?? undefined,
        redesign_rating_data: redesignRating,
      }),
      signal: options.signal,
    });
  } catch (error: any) {
    console.error('[rater] saveRedesignRating fetch error:', error?.message || error);
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new Error('Unable to reach the redesign service. Please try again.');
  }

  const rawBody = await response.text();
  if (!response.ok) {
    const message = extractErrorMessage(rawBody) ?? `Failed to save redesign rating (status ${response.status}).`;
    console.warn('[rater] saveRedesignRating non-OK response:', response.status, rawBody?.slice?.(0, 200) ?? rawBody);
    throw new Error(`[${response.status}] ${message}`);
  }
}

// Minimal metadata retained for type clarity if needed later
const breakdownMeta: Record<RatingAspectKey, { label: string; aliases: string[] }> = {
  aura: { label: 'Aura', aliases: [] },
  fit: { label: 'Fit', aliases: [] },
  palette: { label: 'Palette', aliases: [] },
  trend: { label: 'Trend', aliases: [] },
};

export function normalizeRatingResult(data: unknown): RatingResult {
  const result = data as RatingResult;

  // We trust the JSON schema from the backend.
  // This is just a final sanity check in case the API call fails catastrophically.
  if (typeof result?.overall?.score !== 'number' || !Array.isArray(result?.subscores) || result.subscores.length < 4) {
    console.error('[rater] Invalid or incomplete data from backend:', result);
    throw new Error('Unexpected response format from the rating service.');
  }

  // The data is already in the correct format. Just return it.
  return result;
}

// With backend-enforced schema, no client-side normalization is needed

// Removed: legacy matching utilities

// Removed: legacy key guessing helper

// Removed: legacy default subscore generation

// Removed: legacy feedback heuristics

// Removed: legacy insight heuristics

// Removed: utility clamp

// Removed: legacy label mapping

// Removed: isRecord helper

// Removed: number parsing helper

// Removed: string parsing helper

/**
 * Fetch redesign history for a user
 */
export async function getRedesignHistory(deviceUUID: string): Promise<any[]> {
  const apiUrl = getApiUrl();
  const baseEndpoint = resolveEndpoint(process.env.EXPO_PUBLIC_RATER_URL);

  if (!deviceUUID) return [];

  const endpoint = apiUrl
    ? `${apiUrl}/outfits/${deviceUUID}`
    : (baseEndpoint ? baseEndpoint.replace('/rate', `/outfits/${deviceUUID}`) : null);

  if (!endpoint) return [];

  try {
    const response = await fetch(endpoint, {
      headers: getHeaders(deviceUUID)
    });

    if (!response.ok) return [];

    return await response.json();
  } catch (e) {
    console.warn('[rater] History fetch error:', e);
    return [];
  }
}

/**
 * Get user stats (streak, credits, etc)
 */
export async function getUserStats(deviceUUID: string): Promise<{
  current_streak: number;
  redesign_credits: number;
  scan_count: number;
  is_premium: boolean;
}> {
  const apiUrl = getApiUrl();
  const baseEndpoint = resolveEndpoint(process.env.EXPO_PUBLIC_RATER_URL);

  if (!deviceUUID) return { current_streak: 0, redesign_credits: 0, scan_count: 0, is_premium: false };

  const endpoint = apiUrl
    ? `${apiUrl}/user/stats/${deviceUUID}`
    : (baseEndpoint ? baseEndpoint.replace('/rate', `/user/stats/${deviceUUID}`) : null);

  if (!endpoint) return { current_streak: 0, redesign_credits: 0, scan_count: 0, is_premium: false };

  try {
    const response = await fetch(endpoint, {
      headers: getHeaders(deviceUUID)
    });

    if (!response.ok) return { current_streak: 0, redesign_credits: 0, scan_count: 0, is_premium: false };

    return await response.json();
  } catch (e) {
    console.warn('[rater] Stats fetch error:', e);
    return { current_streak: 0, redesign_credits: 0, scan_count: 0, is_premium: false };
  }
}

function resolveEndpoint(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.toString();
  } catch {
    console.warn(`EXPO_PUBLIC_RATER_URL is not a valid URL: ${trimmed}`);
    return null;
  }
}

function resolveApiKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasSerializableContent(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function extractErrorMessage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // If the backend/proxy returns HTML (common with ngrok error pages), show a friendly error.
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith('<!doctype html') || lowered.startsWith('<html')) {
    const ngrokCodeMatch = trimmed.match(/ERR_NGROK_\d+/);
    const ngrokCode = ngrokCodeMatch?.[0];
    const extra = ngrokCode ? ` (${ngrokCode})` : '';
    if (lowered.includes('ngrok')) {
      return `Your rating URL returned an ngrok HTML page${extra}. This usually means your ngrok tunnel is down or EXPO_PUBLIC_RATER_URL is pointing to the wrong tunnel. Restart ngrok and update EXPO_PUBLIC_RATER_URL.`;
    }
    return `The rating service returned an HTML page${extra} instead of JSON. This usually means EXPO_PUBLIC_RATER_URL is wrong or your backend/ngrok tunnel is not running.`;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const keys = ['message', 'error', 'detail', 'title'];
      for (const k of keys) {
        const v = parsed[k];
        if (typeof v === 'string' && v.trim().length > 0) {
          return v.trim();
        }
      }
    }
  } catch {
    // Not JSON, fall through to trimmed text
  }
  return trimmed;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
