import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import heicConvert from 'heic-convert';
import multer from 'multer';
import OpenAI from 'openai';
import sharp from 'sharp';
// Note: File uploads are handled in memory; no fs/path needed

dotenv.config();

// ============================================================================
// STYLE GUIDE - Detailed aesthetic definitions for accurate AI ratings
// ============================================================================
const STYLE_GUIDE = {
  'y2k': {
    name: 'Y2K',
    palette: 'Bright pinks, baby blue, metallics, white, pastels. Bold color blocking. Rhinestones and bling.',
    fit: 'Mix of fitted (baby tees, low-rise) and baggy (cargo pants, wide-leg jeans). Cropped tops are key.',
    keyPieces: 'Baby tees, low-rise jeans, butterfly clips, platform shoes, mini skirts, bedazzled items, velour tracksuits',
    vibe: 'Playful, nostalgic, fun, early 2000s pop star energy. Think Paris Hilton, early Britney.',
    praise: 'bold colors, fun accessories, nostalgic pieces, playful energy',
    avoid: 'Do NOT suggest muted colors or "grown up" pieces. Embrace the maximalism.'
  },
  'streetwear': {
    name: 'Streetwear',
    palette: 'Neutral bases (black, white, grey, earth tones) with bold accent pieces. Brand logos acceptable.',
    fit: 'OVERSIZED is key. Baggy pants, boxy tees, relaxed hoodies. Fitted looks are NOT streetwear.',
    keyPieces: 'Oversized hoodies, baggy cargo pants, chunky sneakers (Jordans, Dunks, New Balance), graphic tees, dad caps',
    vibe: 'Effortlessly cool, urban, confident, hypebeast energy. Comfort meets style.',
    praise: 'oversized silhouettes, fresh sneakers, layering, confident styling',
    avoid: 'NEVER suggest fitted or tailored clothes. Suggest better sneakers, accessories, or layering instead.'
  },
  'old-money': {
    name: 'Old Money',
    palette: 'Neutrals only: beige, navy, cream, white, camel, forest green, burgundy. NO bright colors.',
    fit: 'Tailored and polished but not tight. Well-fitted, classic cuts. Quality over quantity.',
    keyPieces: 'Polo shirts, cashmere sweaters, loafers, linen pants, blazers, cable-knit, tennis skirts, pearl jewelry',
    vibe: 'Quiet luxury, understated elegance, "I summer in the Hamptons" energy. Timeless, not trendy.',
    praise: 'classic silhouettes, quality fabrics, subtle elegance, timeless pieces',
    avoid: 'Avoid suggesting logos, bright colors, or trendy pieces. Keep it classic.'
  },
  'gorpcore': {
    name: 'Gorpcore',
    palette: 'Earth tones, olive, tan, orange accents, black. Technical fabric colors.',
    fit: 'Relaxed and functional. Oversized fleeces, baggy hiking pants. Comfort and utility first.',
    keyPieces: 'Fleece jackets (Patagonia, North Face), hiking boots, cargo pants, puffer vests, technical fabrics, Salomon shoes',
    vibe: 'Outdoor adventure meets urban fashion. Practical but stylish. "I could hike but I\'m getting coffee."',
    praise: 'functional pieces, good layering, outdoor-ready aesthetic, technical fabrics',
    avoid: 'Do NOT suggest formal or sleek pieces. Embrace the rugged, outdoorsy vibe.'
  },
  'coquette': {
    name: 'Coquette',
    palette: 'Soft pinks, whites, creams, pastels, baby blue. Delicate and feminine.',
    fit: 'Fitted bodices with flowy skirts, or soft oversized knits. Romantic silhouettes.',
    keyPieces: 'Bows, ribbons, lace, pearls, ballet flats, mini skirts, corset tops, delicate jewelry, Mary Janes',
    vibe: 'Ultra-feminine, romantic, soft, dainty. "Lana Del Rey in a meadow" energy.',
    praise: 'feminine details, soft textures, romantic styling, delicate accessories',
    avoid: 'Avoid suggesting edgy or masculine pieces. Keep it soft and romantic.'
  },
  'grunge': {
    name: 'Grunge',
    palette: 'Dark and moody: black, dark red, forest green, mustard, burgundy. Muted, not bright.',
    fit: 'Oversized and layered. Baggy band tees, loose flannels, relaxed jeans.',
    keyPieces: 'Flannel shirts, band tees, distressed denim, combat boots (Doc Martens), leather jackets, chokers',
    vibe: 'Rebellious, effortless, 90s Seattle. "I don\'t care but I look cool" energy.',
    praise: 'good layering, distressed pieces, dark color coordination, rebellious vibe',
    avoid: 'NEVER suggest polished or preppy pieces. Keep it raw and effortless.'
  },
  'acubi': {
    name: 'Acubi',
    palette: 'Muted tones: grey, beige, soft blue, white, black. Subtle and understated.',
    fit: 'OVERSIZED and relaxed. Low-rise with baggy tops. Subversive basics. Nothing fitted.',
    keyPieces: 'Oversized tees, low-rise baggy jeans, simple tanks, minimal jewelry, basic sneakers, layered necklaces',
    vibe: 'Korean minimalist Y2K. Effortlessly cool, clean but not boring. "Model off-duty in Seoul."',
    praise: 'clean silhouettes, subtle styling, effortless layering, minimalist accessories',
    avoid: 'NEVER suggest fitted clothes or loud patterns. Keep it simple and oversized.'
  },
  'opium': {
    name: 'Opium',
    palette: 'Dark and dramatic: all black, deep burgundy, silver metallics, dark grey. NO bright colors.',
    fit: 'OVERSIZED and avant-garde. Wide-leg pants, baggy tops, chunky platforms. Dramatic silhouettes.',
    keyPieces: 'All-black outfits, leather pieces, platform boots, chains, silver jewelry, avant-garde cuts, Rick Owens-style',
    vibe: 'Dark, mysterious, avant-garde, slightly intimidating. Playboi Carti aesthetic. "Vampire in the club."',
    praise: 'dark color coordination, bold silhouettes, statement accessories, avant-garde pieces',
    avoid: 'NEVER suggest bright colors or fitted preppy clothes. Suggest darker pieces, chunkier shoes, more chains.'
  },
  'minimalist': {
    name: 'Minimalist',
    palette: 'Strict neutrals: black, white, grey, beige, navy. Clean and simple.',
    fit: 'Well-fitted but not tight. Clean lines, no excess fabric. Structured and intentional.',
    keyPieces: 'Plain tees, well-cut trousers, simple sneakers, minimal jewelry, clean silhouettes, quality basics',
    vibe: 'Less is more. Scandinavian simplicity. Every piece is intentional and high-quality.',
    praise: 'clean lines, quality basics, intentional simplicity, cohesive palette',
    avoid: 'Avoid suggesting bold patterns, logos, or maximalist accessories. Keep it clean.'
  }
};

// Helper function to get style guidance based on user's preferences
function getStyleGuidance(visualTasteResults) {
  if (!visualTasteResults || !Array.isArray(visualTasteResults) || visualTasteResults.length === 0) {
    return null;
  }

  const guidance = visualTasteResults
    .map(styleId => STYLE_GUIDE[styleId])
    .filter(Boolean);

  if (guidance.length === 0) return null;

  let output = '**STYLE PREFERENCES BREAKDOWN:**\n';
  output += 'The user likes these specific aesthetics. Use this to judge their outfit:\n\n';

  guidance.forEach(style => {
    output += `**${style.name}:**\n`;
    output += `- Colors: ${style.palette}\n`;
    output += `- Fit: ${style.fit}\n`;
    output += `- Key pieces: ${style.keyPieces}\n`;
    output += `- Vibe: ${style.vibe}\n`;
    output += `- Praise when you see: ${style.praise}\n`;
    output += `- AVOID suggesting: ${style.avoid}\n\n`;
  });

  // Determine if user prefers baggy or fitted based on their styles
  const baggyStyles = ['streetwear', 'acubi', 'opium', 'grunge', 'gorpcore', 'y2k'];
  const fittedStyles = ['old-money', 'minimalist'];

  const prefersBaggy = visualTasteResults.some(s => baggyStyles.includes(s));
  const prefersFitted = visualTasteResults.some(s => fittedStyles.includes(s)) && !prefersBaggy;

  if (prefersBaggy) {
    output += '⚠️ **IMPORTANT:** This user prefers OVERSIZED/BAGGY aesthetics. Do NOT suggest "more fitted" clothing. Their baggy fit is INTENTIONAL and correct for their style.\n';
  }

  return output;
}

// Initialize Supabase client (anon key for regular operations)
const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Initialize Supabase admin client (service role for storage uploads)
const supabaseAdmin = createClient(
  process.env.SUPABASE_PROJECT_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// ============================================================================
// SUPABASE STORAGE FUNCTIONS
// ============================================================================

/**
 * Upload image buffer to Supabase Storage
 * @param {Buffer} buffer - Image buffer
 * @param {'original' | 'redesign'} type - Type prefix for filename
 * @returns {Promise<string>} Public URL
 */
async function uploadToSupabase(buffer, type = 'original') {
  const filename = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

  const { data, error } = await supabaseAdmin.storage
    .from('outfits')
    .upload(filename, buffer, {
      contentType: 'image/jpeg',
      upsert: false
    });

  if (error) {
    console.error(`[uploadToSupabase] Error uploading ${type} image:`, error);
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('outfits')
    .getPublicUrl(filename);

  console.log(`[uploadToSupabase] ${type} image uploaded: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

/**
 * Download image from URL and upload to Supabase
 * @param {string} imageUrl - URL to download from
 * @param {'original' | 'redesign'} type - Type prefix for filename
 * @returns {Promise<string>} Public URL
 */
async function downloadAndUploadToSupabase(imageUrl, type = 'redesign') {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return uploadToSupabase(buffer, type);
}

// ============================================================================
// SEEDREAM 4.5 INTEGRATION
// ============================================================================

/**
 * Generate redesigned outfit image using Seedream 4.5 Edit
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string} mimeType - Image MIME type
 * @param {string} redesignPrompt - Prompt describing the outfit changes
 * @returns {Promise<string>} URL of the generated image
 */
async function generateRedesignImage(imageBuffer, mimeType, redesignPrompt) {
  const KIE_API_KEY = process.env.KIE_AI_API_KEY;

  if (!KIE_API_KEY) {
    throw new Error('KIE_AI_API_KEY not configured');
  }

  // Upload to Supabase first to get a public URL
  console.log('[generateRedesignImage] Uploading input image to Supabase...');
  const inputImageUrl = await uploadToSupabase(imageBuffer, 'redesign_input');

  console.log(`[generateRedesignImage] Creating Seedream task with prompt: ${redesignPrompt.slice(0, 100)}...`);

  // Create Seedream task
  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIE_API_KEY}`
    },
    body: JSON.stringify({
      model: 'seedream/4.5-edit',
      input: {
        image_urls: [inputImageUrl],
        prompt: redesignPrompt,
        aspect_ratio: '9:16',
        quality: 'basic'
      }
    })
  });

  const createResult = await createResponse.json();

  if (createResult.code !== 200) {
    console.error(`[generateRedesignImage] Seedream create failed:`, createResult);
    throw new Error(`Seedream create failed: ${createResult.message || 'Unknown error'}`);
  }

  const taskId = createResult.data.taskId;
  console.log(`[generateRedesignImage] Task created: ${taskId}`);

  // Poll for completion (max 60 seconds)
  const finalRedesignUrl = await pollSeedreamTask(taskId, KIE_API_KEY);
  return finalRedesignUrl;
}

/**
 * Poll Seedream task until completion
 * @param {string} taskId - Task ID to poll
 * @param {string} apiKey - KIE API key
 * @returns {Promise<string>} URL of the generated image
 */
async function pollSeedreamTask(taskId, apiKey) {
  const maxAttempts = 150; // 5 minutes (was 30 = 60s)
  const pollInterval = 2000; // 2 seconds

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, pollInterval));

    // NOTE: KIE docs call this endpoint "Query Task"
    // https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
    const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const rawText = await response.text();
    if (!response.ok) {
      console.error(`[pollSeedreamTask] HTTP ${response.status}:`, rawText?.slice?.(0, 300) ?? rawText);
      throw new Error(`Seedream polling failed with HTTP ${response.status}`);
    }

    let result;
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      console.error('[pollSeedreamTask] Non-JSON response:', rawText?.slice?.(0, 300) ?? rawText);
      throw new Error('Seedream polling returned non-JSON response');
    }

    if (result?.code !== 200) {
      console.error('[pollSeedreamTask] Non-200 API response:', result);
      throw new Error(`Seedream polling failed: ${result?.message || 'Unknown error'}`);
    }

    const state = result?.data?.state ?? result?.data?.status;
    console.log(`[pollSeedreamTask] Attempt ${i + 1}/${maxAttempts}, state: ${state}`);

    if (state === 'success' || state === 'succeeded') {
      const resultJsonRaw = result?.data?.resultJson;
      let resultJson = resultJsonRaw;
      if (typeof resultJsonRaw === 'string') {
        try {
          resultJson = JSON.parse(resultJsonRaw);
        } catch (e) {
          console.error('[pollSeedreamTask] Failed to parse resultJson string:', resultJsonRaw);
          throw new Error('Seedream returned success but resultJson could not be parsed');
        }
      }

      const imageUrl = resultJson?.resultUrls?.[0];
      if (!imageUrl) {
        console.error('[pollSeedreamTask] Success payload missing resultUrls:', { data: result?.data, resultJson });
        throw new Error('Seedream returned success but no image URL');
      }

      console.log(`[pollSeedreamTask] Success! Image URL: ${imageUrl}`);
      return imageUrl;
    }

    if (state === 'fail' || state === 'failed') {
      console.error(`[pollSeedreamTask] Task failed:`, result?.data);
      throw new Error(`Seedream generation failed: ${result?.data?.failMsg || 'Unknown error'}`);
    }

    // Still processing, continue polling
  }

  const seconds = Math.round((maxAttempts * pollInterval) / 1000);
  throw new Error(`Seedream generation timed out after ${seconds} seconds`);
}

/**
 * Normalize image buffer (handle HEIC conversion)
 * Extracted for reuse between endpoints
 */
async function normalizeImageBuffer(fileBuffer, fileMimeType, originalName) {
  let imageBuffer = fileBuffer;
  let mimeType = fileMimeType?.toLowerCase() ?? '';

  if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg';
  }

  const isHeicUpload =
    HEIC_MIME_TYPES.has(mimeType) || originalName?.endsWith('.heic') || originalName?.endsWith('.heif');

  if (isHeicUpload) {
    const convertedBuffer = await heicConvert({
      buffer: imageBuffer,
      format: 'JPEG',
      quality: 0.9,
    });
    imageBuffer = await sharp(convertedBuffer, { failOnError: false }).rotate().jpeg({ quality: 90 }).toBuffer();
    mimeType = 'image/jpeg';
    console.log(`[normalizeImageBuffer] Converted HEIC to JPEG (${Math.round(imageBuffer.length / 1024)}kb)`);
  }

  return { imageBuffer, mimeType };
}

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);

// Configure multer for in-memory handling of image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage, // Use memory storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enable CORS for your mobile app
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stylst-ai-backend' });
});

// Middleware to verify API key (optional but recommended)
const verifyApiKey = (req, res, next) => {
  const apiKey = process.env.API_KEY;

  // Skip verification if API_KEY is not set in environment
  if (!apiKey) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== apiKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    return;
  }

  next();
};

// Main rating endpoint
app.post('/rate', verifyApiKey, upload.single('image'), async (req, res) => {
  console.log(
    `[rate] ${new Date().toISOString()} ↩️ request from ${req.ip ?? req.connection?.remoteAddress ?? 'unknown'} ` +
    `(content-type=${req.headers['content-type'] ?? 'unknown'})`,
  );
  try {
    // Validate request
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    // Parse optional profile data
    let profile = null;
    if (req.body.profile) {
      try {
        profile = JSON.parse(req.body.profile);
        console.log(`[rate] ${new Date().toISOString()} 📋 Profile received:`, JSON.stringify(profile, null, 2));
      } catch (error) {
        console.warn('[rate] Failed to parse profile data:', error);
      }
    } else {
      console.log(`[rate] ${new Date().toISOString()} ⚠️ No profile data in request`);
    }

    // Parse optional context
    const context = req.body.context;
    if (context) {
      console.log(`[rate] ${new Date().toISOString()} 🏷️ Context received: "${context}"`);
    }

    // Normalize uploaded image (convert HEIC/HEIF to JPEG for OpenAI compatibility)
    const originalName = req.file.originalname?.toLowerCase() ?? '';
    let mimeType = req.file.mimetype?.toLowerCase() ?? '';
    let imageBuffer = req.file.buffer;

    if (mimeType === 'image/jpg') {
      mimeType = 'image/jpeg';
    }

    const isHeicUpload =
      HEIC_MIME_TYPES.has(mimeType) || originalName.endsWith('.heic') || originalName.endsWith('.heif');

    if (isHeicUpload) {
      try {
        const convertedBuffer = await heicConvert({
          buffer: imageBuffer,
          format: 'JPEG',
          quality: 0.9,
        });
        imageBuffer = await sharp(convertedBuffer, { failOnError: false }).rotate().jpeg({ quality: 90 }).toBuffer();
        mimeType = 'image/jpeg';
        console.log(
          `[rate] ${new Date().toISOString()} 🔄 converted HEIC upload to JPEG (${Math.round(
            imageBuffer.length / 1024,
          )}kb)`,
        );
      } catch (conversionError) {
        console.error(`[rate] ${new Date().toISOString()} ⚠️ HEIC conversion failed`, conversionError);
        res.status(400).json({ error: 'We could not process that HEIC photo. Please try again with a different photo.' });
        return;
      }
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      res
        .status(400)
        .json({ error: 'Unsupported image format. Please upload a PNG, JPEG, GIF, or WebP photo instead.' });
      return;
    }

    // Convert normalized buffer (from memory) to base64
    const base64Image = imageBuffer.toString('base64');

    // Build a useful profile context (Style DNA)
    let profileContext = 'No user profile provided.';
    let styleGuidance = '';
    if (profile && typeof profile === 'object') {
      try {
        const dna = [];
        if (profile.identity) dna.push(`- Identity: ${profile.identity}`);
        if (profile.age) dna.push(`- Age: ${profile.age}`);
        if (profile.goal) dna.push(`- Goal: They want to "${profile.goal}"`);
        const balance = Number(profile.comfortStyleBalance);
        if (!Number.isNaN(balance)) {
          const style = Math.round(balance * 100);
          dna.push(`- Priority: ${style}% Style, ${100 - style}% Comfort.`);
        }
        // Check for visual taste data
        const visualTaste = profile.visualTasteResults || profile.visualQuizResults;
        if (Array.isArray(visualTaste)) {
          const likes = visualTaste
            .map(item => {
              if (typeof item === 'string') return item;
              if (item && item.response === 'love') return item.style;
              return null;
            })
            .filter(Boolean);
          if (likes.length) {
            dna.push(`- Style preferences: They like ${likes.join(', ')}.`);
            // Generate detailed style guidance
            styleGuidance = getStyleGuidance(likes);
            if (styleGuidance) {
              console.log(`[rate] ${new Date().toISOString()} 🎨 Style guidance generated for: ${likes.join(', ')}`);
            }
          }
        }

        if (Array.isArray(profile.colorProfile) && profile.colorProfile.length) {
          dna.push(`- Color preferences: ${profile.colorProfile.join(', ')}.`);
        }

        if (Array.isArray(profile.fitProfile) && profile.fitProfile.length) {
          dna.push(`- Fit preferences: ${profile.fitProfile.join(', ')}.`);
        }
        if (dna.length) {
          profileContext = `Use this Style DNA heavily in your critique:\n${dna.join('\n')}`;
          console.log(`[rate] ${new Date().toISOString()} 🧬 Style DNA built:\n${profileContext}`);
        }
      } catch (e) {
        console.warn('[rate] Failed to build Style DNA from profile:', e);
      }
    }

    // Build Context Instruction
    let contextInstruction = "";
    if (context) {
      contextInstruction = `
IMPORTANT CONTEXT:
The user is dressing for: "${context}".
Adjust your rating and feedback to specifically address how well the outfit fits this occasion.
If the context is "ROAST ME", be extra savage and witty.
If the context is "DATE", focus on appeal and confidence.
If the context is "OFFICE", focus on professionalism.
`;
    }

    // Check for redesign mode
    const redesignFix = req.body.redesign;
    const originalScore = req.body.originalScore ? parseInt(req.body.originalScore, 10) : null;
    let redesignInstruction = "";

    if (redesignFix) {
      console.log(`[rate] ${new Date().toISOString()} ✨ REDESIGN MODE - Fix applied: "${redesignFix}"`);
      redesignInstruction = `
**🔄 REDESIGN MODE ACTIVE**
The user previously had their outfit rated and received this suggestion: "${redesignFix}"
${originalScore ? `Their original score was ${originalScore}/100.` : ''}

IMPORTANT: You are rating this outfit AS IF the suggested change "${redesignFix}" was successfully applied.
- The user made an effort to improve based on your advice
- Be encouraging but honest about the improvement
- The new score should typically be higher than the original (they followed advice!)
- Give credit for making the change, but still provide a new potential fix for further improvement
- The headline should reflect the improvement (e.g., "GLOW UP", "LEVELED UP", "THAT'S MORE LIKE IT")
- Be positive about the transformation while still being honest
`;
    }

    // Upload original image to Supabase (for history)
    let publicUrl = null;
    try {
      publicUrl = await uploadToSupabase(imageBuffer, 'original');
    } catch (ulErr) {
      console.warn('[rate] Failed to upload image to Supabase:', ulErr);
    }

    const prompt = `You are Stylst, the internet's most honest fashion bestie. You speak fluent Gen-Z/TikTok (words like "aura," "cooked," "ate," "clean," "mid"). You are witty, dry, and brutally honest.

**STEP 1: IMAGE VALIDATION**
Check if the image is a valid outfit (torso/full body).
- ❌ INVALID: Face selfies, pets, blurry mess. Return score: 0.
- ✅ VALID: Proceed.

If INVALID, return:
{
  "overall": { "score": 0, "label": "Not an outfit" },
  "compliment": "Nice photo.",
  "critique": "But I can't rate this—I need to see your outfit! Take a photo showing what you're wearing.",
  "redesign_prompt": "N/A",
  "potential_score": 0,
  "score_justification": "Cannot rate—no outfit visible in the image.",
  "subscores": [
    { "key": "aura", "label": "Aura", "score": 0, "insight": "N/A" },
    { "key": "fit", "label": "Fit", "score": 0, "insight": "N/A" },
    { "key": "palette", "label": "Palette", "score": 0, "insight": "N/A" },
    { "key": "trend", "label": "Trend", "score": 0, "insight": "N/A" }
  ]
}

${redesignInstruction}

**STEP 2: ANALYZE & INFER CONTEXT**
${contextInstruction ? contextInstruction : 'Since the user hasn\'t told you where they are going, LOOK at the outfit and guess.\n- Wearing a suit? Judge them on "Business/Formal."\n- Wearing sweats? Judge them on "Loungewear/Streetwear."'}

**STEP 3: THE GRADING CURVE**
* **0-49 (Cooked):** Fashion crimes. Clashing colors, terrible proportions, or genuinely bad styling.
* **50-69 (Mid):** The "NPC" zone. Unintentional, sloppy, or just boring. Nothing wrong, but nothing right either.
* **70-89 (Valid):** Solid fit. Includes "Clean" and "Simple" outfits. If it looks good, it's at least a 75. 
* **90-100 (God Tier):** Pinterest board worthy. Unique, perfectly executed, or just an undeniable vibe.

**IMPORTANT:** Be HONEST with scores. Don't inflate them. A basic but clean outfit should be 75-80, not 90. A genuinely mid outfit should be 50-65, not 70+. Only give 90+ to truly exceptional fits.

**STEP 3.5: SCORING NUANCE**
- **SIMPLICITY IS NOT A CRIME.** A plain white tee and nice jeans that fit perfectly is a **CLEAN fit (75-85)**, not "Mid".
- **DO NOT PENALIZE BASICS.** If the pieces are basic but the fit/silhouette is good, the score should be high.
- **VINTAGE / DISTRESSED IS NOT "SLOPPY".** Faded washes, rips, and "worn" textures are INTENTIONAL. Do not deduct points for them.
- **"MID" (50-69)** is reserved for: bad proportions, clashing colors, zero effort, or unintentional messiness.
- **"VALID" (70-89)** is for: clean execution, good color blocking, solid simple outfits, OR well-executed grunge/vintage looks.

**STEP 3.6: SCORE JUSTIFICATION (CRITICAL)**
You MUST provide a thorough, honest explanation for why the score is what it is. Be specific and transparent:
- **Why it's not higher:** What specific elements are holding it back? (e.g., "The color palette is solid but the proportions are off—the oversized top with skinny jeans creates an unbalanced silhouette.")
- **Why it's not lower:** What specific elements are saving it? (e.g., "The fit is actually intentional and the color coordination is cohesive, which prevents it from being a complete miss.")
- **Why it deserves this exact score:** Break down how the subscores (aura, fit, palette, trend) combine to create this overall score. Be honest—don't inflate scores. If it's a 65, explain why it's a 65, not a 75.
- **Be brutally honest:** If the outfit is genuinely mid (50-69), explain why. If it's genuinely good (75-89), explain why. Don't "cook" the scores—be transparent about what you're seeing.

**STEP 4: GENERATE THE CONTENT**
* **Headline:** A 1-2 word brutal summary (e.g., "OFFICE DRONE", "NPC ENERGY", "ABSOLUTE CINEMA").
* **The W (Compliment):** One specific thing they did right (e.g., "Shoulder fit is actually solid.") (Max 80 characters).
* **The L (Critique):** One specific thing they need to fix (e.g., "Those shoes are killing the vibe.") (Max 80 characters).
* **Redesign Prompt:** A simple, focused prompt for AI image generation. Tell the AI WHAT clothing to change, not what to preserve.
  - **CRITICAL:** This prompt MUST directly address "The L" (Critique) you wrote above. If you criticized the shoes, change the shoes. If you criticized the fit, change the fit.
  - FORMAT: "Change [specific item] to [new item with color, fit, style details]. Keep everything else exactly the same."
  - EXAMPLES:
    - "Change the skinny jeans to wide-leg olive cargo pants. Keep everything else exactly the same."
    - "Swap the plain white tee for an oversized black graphic hoodie. Keep everything else exactly the same."
    - "Add a chunky silver chain necklace and change the sneakers to black combat boots. Keep everything else exactly the same."
  - Be specific about what the NEW item looks like (color, fit, style)
  - Always end with "Keep everything else exactly the same."
  - Don't describe the person, pose, or background - the AI preserves those automatically
  - For streetwear/acubi/opium users, NEVER suggest fitted clothes—suggest cooler baggy pieces instead.
* **Potential Score:** The estimated score (0-100) if they make this change. Be AMBITIOUS—if one small change could elevate the look, give it 85-95+. Don't be conservative.

**STEP 5: DETAILED METRICS (0-100)**
1. **Aura**: The "vibe" score. Does the outfit project confidence and intentionality?
2. **Fit**: Does the silhouette match the user's INTENDED aesthetic? For streetwear/acubi/opium/Y2K/gorpcore users, baggy IS the correct fit. Score HIGH for intentionally oversized looks if that's their style. Only penalize fit if it looks accidental or sloppy.
3. **Palette**: Color coordination and harmony.
4. **Trend**: How current is the look? Baggy/oversized dominates streetwear, Y2K, gorpcore, acubi, and opium aesthetics right now. Score it HIGH.

**CRITICAL STYLE RULES (MUST FOLLOW):**
- **CLEAN / SIMPLE = GOOD.** Do not call a clean outfit "Mid".
- NEVER suggest "more fitted" or "tailored" clothing to users who prefer streetwear, acubi, opium, Y2K, gorpcore, or grunge aesthetics. These styles EMBRACE baggy/oversized fits.
- Baggy jeans, oversized hoodies, wide-leg pants, and relaxed silhouettes are NOT flaws—they ARE the aesthetic.
- For streetwear/acubi/opium lovers: baggy = good. Fitted = against their style.
- Only suggest fitted alternatives if the user's Style DNA explicitly mentions minimalist, old money, or formal preferences.
- Judge the outfit by its OWN aesthetic goals. A perfect streetwear outfit is baggy ON PURPOSE.
- Potential fixes should suggest accessories, colors, or layering—NOT making clothes more fitted (unless their style calls for it).

**USER STYLE DNA CONTEXT (USE THIS HEAVILY):**
${profileContext}

${styleGuidance ? styleGuidance : ''}

**REMINDER:** If the user likes streetwear, acubi, opium, Y2K, gorpcore, or grunge—DO NOT recommend fitted clothing. Use the style breakdown above to give suggestions that FIT their aesthetic.

**JSON OUTPUT ONLY:**
You must provide your analysis in the strict JSON schema provided.`;

    // Call OpenAI API with structured output
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'outfit_rating',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              overall: {
                type: 'object',
                properties: {
                  score: {
                    type: 'number',
                    description: 'Overall outfit score from 0-100',
                  },
                  label: {
                    type: 'string',
                    description: 'A 1-2 word brutal summary headline (e.g. "OFFICE DRONE", "NPC ENERGY")',
                  },
                },
                required: ['score', 'label'],
                additionalProperties: false,
              },
              compliment: {
                type: 'string',
                description: 'THE W: A specific compliment about the outfit. Max 80 characters.',
              },
              critique: {
                type: 'string',
                description: 'THE L: A specific critique about the outfit. Max 80 characters.',
              },
              redesign_prompt: {
                type: 'string',
                description: 'Simple prompt for AI image generation describing what to change (e.g. "Change the skinny jeans to wide-leg olive cargo pants. Keep everything else exactly the same.")',
              },
              potential_score: {
                type: 'number',
                description: 'The projected score (0-100) if they make the change',
              },
              score_justification: {
                type: 'string',
                description: 'A thorough, honest explanation (2-4 sentences) explaining: 1) Why the score is not higher (what\'s holding it back), 2) Why it\'s not lower (what\'s saving it), 3) Why it deserves this exact score based on the subscores. Be brutally honest—don\'t inflate scores.',
              },
              subscores: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key: {
                      type: 'string',
                      enum: ['aura', 'fit', 'palette', 'trend'],
                    },
                    label: {
                      type: 'string',
                      description: 'Display label for this aspect',
                    },
                    score: {
                      type: 'number',
                      description: 'Score from 0-100 for this aspect',
                    },
                    insight: {
                      type: 'string',
                      description: 'Brief insight (max 5 words)',
                    },
                  },
                  required: ['key', 'label', 'score', 'insight'],
                  additionalProperties: false,
                },
                description: 'Exactly four subscores for aura, fit, palette, and trend',
              },
            },
            required: ['overall', 'compliment', 'critique', 'redesign_prompt', 'potential_score', 'score_justification', 'subscores'],
            additionalProperties: false,
          },
        },
      },
      reasoning_effort: 'low',
      //max_tokens: 1000, //not supported by 5 mini
      //temperature: 0.7, //only 1 supported by 5 mini
    });

    // Parse the response
    const result = JSON.parse(completion.choices[0].message.content);

    // Save to DB
    const deviceUUID = req.headers['x-device-uuid'];
    if (deviceUUID && publicUrl) {
      const { data: outfitData, error: dbError } = await supabaseAdmin // Use admin for reliable write
        .from('outfits')
        .insert({
          device_uuid: deviceUUID,
          original_image_storage_path: publicUrl.split('/').pop(), // Extract filename
          original_image_url: publicUrl,
          score: result.overall?.score,
          label: result.overall?.label,
          rating_data: result, // Full JSON
          status: 'rated',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (!dbError && outfitData) {
        result.outfit_id = outfitData.id;
        console.log(`[rate] Saved to history with ID: ${outfitData.id}`);

        // Update user stats (streak, scan count)
        updateUserStats(deviceUUID);
      } else if (dbError) {
        console.warn('[rate] DB Insert Error:', dbError);
      }
    }

    console.log(
      `[rate] ${new Date().toISOString()} ✅ completed for ${req.ip ?? 'unknown'} ` +
      `(overall=${result?.overall?.score ?? 'n/a'})`,
    );
    if (result?.redesign_prompt) {
      console.log(`[rate] 💡 Redesign Prompt: "${result.redesign_prompt.slice(0, 80)}..."`);
    }

    res.json(result);

  } catch (error) {
    console.error('[rate] Error analyzing outfit:', error);
    res.status(500).json({
      error: 'Failed to analyze outfit',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

// NOTE: RevenueCat webhook is handled by Supabase Edge Function
// No webhook endpoint needed in Express backend

// Generate redesign endpoint - calls Seedream 4.5 Edit to transform outfit
app.post('/generate-redesign', verifyApiKey, upload.single('image'), async (req, res) => {
  console.log(`[generate-redesign] ${new Date().toISOString()} ↩️ request received`);

  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }

    const redesignPrompt = req.body.redesign_prompt;
    if (!redesignPrompt) {
      res.status(400).json({ error: 'No redesign_prompt provided' });
      return;
    }

    // Normalize image (handle HEIC conversion)
    const originalName = req.file.originalname?.toLowerCase() ?? '';
    let mimeType = req.file.mimetype?.toLowerCase() ?? '';
    let imageBuffer = req.file.buffer;

    if (mimeType === 'image/jpg') {
      mimeType = 'image/jpeg';
    }

    const isHeicUpload =
      HEIC_MIME_TYPES.has(mimeType) || originalName.endsWith('.heic') || originalName.endsWith('.heif');

    if (isHeicUpload) {
      try {
        const convertedBuffer = await heicConvert({
          buffer: imageBuffer,
          format: 'JPEG',
          quality: 0.9,
        });
        imageBuffer = await sharp(convertedBuffer, { failOnError: false }).rotate().jpeg({ quality: 90 }).toBuffer();
        mimeType = 'image/jpeg';
        console.log(`[generate-redesign] Converted HEIC to JPEG (${Math.round(imageBuffer.length / 1024)}kb)`);
      } catch (conversionError) {
        console.error(`[generate-redesign] HEIC conversion failed:`, conversionError);
        res.status(400).json({ error: 'Failed to process HEIC image' });
        return;
      }
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      res.status(400).json({ error: 'Unsupported image format' });
      return;
    }

    console.log(`[generate-redesign] Calling Seedream with prompt: ${redesignPrompt.slice(0, 100)}...`);

    // Generate redesigned image using Seedream 4.5 Edit
    const seedreamUrl = await generateRedesignImage(imageBuffer, mimeType, redesignPrompt);
    console.log(`[generate-redesign] Seedream generated: ${seedreamUrl}`);

    // Upload to Supabase for persistence
    const permanentUrl = await downloadAndUploadToSupabase(seedreamUrl, 'redesign');
    console.log(`[generate-redesign] ✅ Uploaded to Supabase: ${permanentUrl}`);

    res.json({ imageUrl: permanentUrl });

  } catch (error) {
    console.error(`[generate-redesign] ${new Date().toISOString()} ❌ Error:`, error);
    res.status(500).json({
      error: 'Failed to generate redesign',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

// ============================================================================
// USER STATS & STREAK LOGIC
// ============================================================================

/**
 * Update user stats (scans, streak) after a rating
 */
async function updateUserStats(deviceUUID) {
  try {
    // defaults
    let newStreak = 1;
    let newScanCount = 1;

    // Fetch current stats
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('scan_count, current_streak, last_active_date')
      .eq('device_uuid', deviceUUID)
      .single();

    if (!user && !error) {
      // Create new user if not exists
      await supabaseAdmin.from('users').insert({
        device_uuid: deviceUUID,
        scan_count: 1,
        current_streak: 1,
        last_active_date: new Date().toISOString(),
        redesign_credits: 1, // Gift from onboarding
        is_premium: false,
        plan: 'free'
      });
      return { streak: 1, scan_count: 1 };
    }

    if (user) {
      // Calculate Streak
      const lastActive = user.last_active_date ? new Date(user.last_active_date) : null;
      const now = new Date();

      // Check if last active was "yesterday" (simple check: different day, diff < 48h)
      // Ideally use a more robust date utility, but this is a decent approximation for MVP
      if (lastActive) {
        const diffHours = (now - lastActive) / (1000 * 60 * 60);
        const isSameDay = now.toDateString() === lastActive.toDateString();

        if (isSameDay) {
          // Already active today, keep streak
          newStreak = user.current_streak;
        } else if (diffHours < 48 && !isSameDay) {
          // It was yesterday (roughly), increment
          newStreak = (user.current_streak || 0) + 1;
        } else {
          // Missed a day, reset
          newStreak = 1;
        }
      }

      newScanCount = (user.scan_count || 0) + 1;

      // Update DB
      await supabaseAdmin
        .from('users')
        .update({
          scan_count: newScanCount,
          current_streak: newStreak,
          last_active_date: now.toISOString()
        })
        .eq('device_uuid', deviceUUID);

      return { streak: newStreak, scan_count: newScanCount };
    }
  } catch (e) {
    console.warn('[updateUserStats] Failed to update stats:', e);
  }
  return null;
}

// GET /user/stats/:device_uuid
app.get('/user/stats/:device_uuid', async (req, res) => {
  const { device_uuid } = req.params;
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('current_streak, redesign_credits, scan_count, is_premium, plan')
      .eq('device_uuid', device_uuid)
      .single();

    // If no user found, return defaults
    if (!user) {
      res.json({
        current_streak: 0,
        redesign_credits: 0,
        scan_count: 0,
        is_premium: false
      });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('[GET /user/stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /user/reset-credits (Debug only)
app.post('/user/reset-credits', verifyApiKey, async (req, res) => {
  const deviceUUID = req.headers['x-device-uuid'];
  if (!deviceUUID) return res.status(400).json({ error: 'No device UUID' });

  await supabaseAdmin
    .from('users')
    .update({ redesign_credits: 1, scan_count: 0 }) // Reset to 1 for testing
    .eq('device_uuid', deviceUUID);

  res.json({ success: true, message: 'Credits reset to 1' });
});


// ============================================================================
// NEW HISTORY & REDESIGN ENDPOINTS
// ============================================================================

// GET /outfits/:device_uuid - Fetch all history
app.get('/outfits/:device_uuid', async (req, res) => {
  const { device_uuid } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('outfits')
      .select('*')
      .eq('device_uuid', device_uuid)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map to frontend expected format if needed
    const formatted = data.map(item => ({
      ...item,
      prompt: item.rating_data?.redesign_prompt || '',
      // Ensure status is compatible
      status: item.status || 'rated'
    }));

    res.json(formatted);
  } catch (error) {
    console.error('[GET /outfits] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /redesigns/status/:id
app.get('/redesigns/status/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('outfits')
      .select('id, status, redesign_image_url')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /redesigns/save-rating
// Save the redesign's rating result back onto the original outfit row so History can render
// accurate "pro/critique" when viewing the glow-up from the closet.
app.post('/redesigns/save-rating', verifyApiKey, async (req, res) => {
  const { outfit_id, redesign_rating_data, redesign_image_url } = req.body || {};

  if (!outfit_id) {
    return res.status(400).json({ error: 'Missing outfit_id' });
  }
  if (!redesign_rating_data || typeof redesign_rating_data !== 'object') {
    return res.status(400).json({ error: 'Missing redesign_rating_data' });
  }

  try {
    const { data: outfit, error: fetchError } = await supabaseAdmin
      .from('outfits')
      .select('id, rating_data, redesign_image_url, status')
      .eq('id', outfit_id)
      .single();

    if (fetchError) throw fetchError;
    if (!outfit) return res.status(404).json({ error: 'Outfit not found' });

    const currentRatingData = outfit.rating_data && typeof outfit.rating_data === 'object' ? outfit.rating_data : {};
    const updatedRatingData = {
      ...currentRatingData,
      redesign_rating_data,
      redesign_rating_saved_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from('outfits')
      .update({
        rating_data: updatedRatingData,
        redesign_image_url: redesign_image_url || outfit.redesign_image_url,
        status: outfit.status === 'failed' ? outfit.status : (outfit.status || 'completed'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', outfit_id);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (error) {
    console.error('[redesigns/save-rating] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /redesigns/create
app.post('/redesigns/create', async (req, res) => {
  const { outfit_id, redesign_prompt } = req.body;

  // Need device UUID to check credits
  // Ideally passed in header or looked up via outfit

  console.log(`[redesigns/create] Request for outfit ${outfit_id}`);

  try {
    // 1. Get outfit and owner info
    const { data: outfit, error: outError } = await supabaseAdmin
      .from('outfits')
      .select('device_uuid, original_image_url')
      .eq('id', outfit_id)
      .single();

    if (!outfit) throw new Error('Outfit not found');

    const deviceUUID = outfit.device_uuid;

    // 2. CHECK CREDITS / PREMIUM
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('is_premium, redesign_credits')
      .eq('device_uuid', deviceUUID)
      .single();

    if (user) {
      if (!user.is_premium && (user.redesign_credits || 0) <= 0) {
        return res.status(403).json({
          error: 'No redesign credits remaining',
          code: 'NO_CREDITS'
        });
      }
yes 
      // Deduct credit if not premium
      if (!user.is_premium) {
        await supabaseAdmin
          .from('users')
          .update({ redesign_credits: (user.redesign_credits || 0) - 1 })
          .eq('device_uuid', deviceUUID);
        console.log(`[redesigns/create] Deducted credit for ${deviceUUID}`);
      }
    }

    // 3. Update status to pending
    const { data, error } = await supabaseAdmin
      .from('outfits')
      .update({
        status: 'pending',
      })
      .eq('id', outfit_id)
      .single();

    if (error) throw error;

    // 4. Start background process (Non-blocking)
    processRedesignInBackground(outfit_id, redesign_prompt, outfit.original_image_url, deviceUUID)
      .catch(err => console.error('[Background] Unhandled error:', err));

    res.json({ data: { id: outfit_id, status: 'pending' } });
  } catch (error) {
    console.error('[redesigns/create] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process redesign in background to avoid timeouts
 */
async function processRedesignInBackground(outfitId, prompt, originalWaitUrl, deviceUUID) {
  console.log(`[Background] Starting redesign for ${outfitId} (User: ${deviceUUID})`);
  try {
    // 1. Update status processing
    await supabaseAdmin.from('outfits').update({ status: 'processing' }).eq('id', outfitId);

    // 2. Download original image
    const resp = await fetch(originalWaitUrl);
    if (!resp.ok) throw new Error('Failed to download original image');
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mime = resp.headers.get('content-type') || 'image/jpeg';

    // 3. Generate Redesign using Schema helper
    const seedreamUrl = await generateRedesignImage(buffer, mime, prompt);
    console.log(`[Background] Generated: ${seedreamUrl}`);

    // 4. Upload result to Supabase
    const permanentUrl = await downloadAndUploadToSupabase(seedreamUrl, 'redesign');

    // 5. Update DB
    await supabaseAdmin
      .from('outfits')
      .update({
        status: 'completed',
        redesign_image_url: permanentUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', outfitId);

    console.log(`[Background] Completed ${outfitId}`);

  } catch (e) {
    console.error(`[Background] Failed ${outfitId}:`, e);

    // Mark as failed
    await supabaseAdmin
      .from('outfits')
      .update({ status: 'failed' })
      .eq('id', outfitId);

    // REFUND CREDIT (if deviceUUID provided)
    if (deviceUUID) {
      try {
        // Fetch current to ensure atomic increment? Supabase doesn't have native atomic increment/decrement easily without stored proc OR rpc.
        // But for this MVP read-modify-write is okay-ish, or better:
        // We can just get the user and +1.

        const { data: user } = await supabaseAdmin
          .from('users')
          .select('redesign_credits, is_premium')
          .eq('device_uuid', deviceUUID)
          .single();

        if (user && !user.is_premium) {
          await supabaseAdmin
            .from('users')
            .update({ redesign_credits: (user.redesign_credits || 0) + 1 })
            .eq('device_uuid', deviceUUID);
          console.log(`[Background] Refunded credit to ${deviceUUID} due to failure`);
        }
      } catch (refundErr) {
        console.error('[Background] Failed to refund credit:', refundErr);
      }
    }
  }
}

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Stylst AI Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Rating endpoint: http://localhost:${PORT}/rate`);
  console.log(`✨ Redesign endpoint: http://localhost:${PORT}/generate-redesign`);
  console.log(`📱 Network access: http://192.168.1.128:${PORT}/rate`);

  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  Warning: OPENAI_API_KEY not set in environment');
  }

  if (!process.env.API_KEY) {
    console.warn('⚠️  Warning: API_KEY not set - endpoint is unprotected');
  }

  if (!process.env.KIE_AI_API_KEY) {
    console.warn('⚠️  Warning: KIE_AI_API_KEY not set - redesign feature will not work');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set - image storage may not work');
  }
});
