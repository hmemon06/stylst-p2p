import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { cors } from 'https://deno.land/x/hono@v3.12.8/middleware.ts'
import { Hono } from 'https://deno.land/x/hono@v3.12.8/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Initialize OpenAI (for rating)
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const KIE_API_KEY = Deno.env.get('KIE_AI_API_KEY') ?? ''

const app = new Hono()

// Enable CORS for your mobile app
app.use('/*', cors())

// Debug: Log all incoming requests
app.use('/*', async (c, next) => {
  console.log(`[API] ${c.req.method} ${c.req.path} (raw: ${c.req.raw.url})`)
  await next()
})

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'stylst-api-edge' })
})

// ============================================================================
// USER STATS ENDPOINTS
// ============================================================================

// GET /user/stats/:device_uuid
app.get('/user/stats/:device_uuid', async (c) => {
  const deviceUuid = c.req.param('device_uuid')

  const { data: user, error } = await supabase
    .from('users')
    .select('current_streak, redesign_credits, scan_count, is_premium, plan')
    .eq('device_uuid', deviceUuid)
    .single()

  if (!user || error) {
    return c.json({
      current_streak: 0,
      redesign_credits: 0,
      scan_count: 0,
      is_premium: false
    })
  }

  return c.json(user)
})

// POST /user/reset-credits (Debug only)
app.post('/user/reset-credits', async (c) => {
  const deviceUuid = c.req.header('x-device-uuid')
  if (!deviceUuid) {
    return c.json({ error: 'No device UUID' }, 400)
  }

  await supabase
    .from('users')
    .update({ redesign_credits: 1, scan_count: 0 })
    .eq('device_uuid', deviceUuid)

  return c.json({ success: true, message: 'Credits reset to 1' })
})

// DELETE /user/:device_uuid
// Permanently deletes a user account and all associated data
app.delete('/user/:device_uuid', async (c) => {
  const deviceUuid = c.req.param('device_uuid')
  const headerUuid = c.req.header('x-device-uuid')

  console.log(`[delete-account] Request to delete user: ${deviceUuid}`)

  // Security check: Ensure the request comes from the device itself
  if (!deviceUuid || deviceUuid !== headerUuid) {
    console.warn(`[delete-account] Security mismatch: params=${deviceUuid}, header=${headerUuid}`)
    return c.json({ error: 'Unauthorized: Device ID mismatch' }, 403)
  }

  try {
    // 1. Delete associated outfits (if Supabase cascading isn't reliable)
    // We use the supabase client initialized with SERVICE_ROLE_KEY to bypass RLS
    const { error: outfitsError } = await supabase
      .from('outfits')
      .delete()
      .eq('device_uuid', deviceUuid)

    if (outfitsError) {
      console.warn('[delete-account] Error deleting outfits:', outfitsError)
      // Continue anyway to try to delete the user
    } else {
      console.log('[delete-account] Deleted associated outfits.')
    }

    // 2. Delete the user record
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('device_uuid', deviceUuid)

    if (userError) {
      console.error('[delete-account] Error deleting user:', userError)
      return c.json({ error: 'Failed to delete user record' }, 500)
    }

    console.log(`[delete-account] Successfully deleted user: ${deviceUuid}`)
    return c.json({ success: true, message: 'Account deleted successfully' })

  } catch (error: any) {
    console.error('[delete-account] Exception:', error)
    return c.json({ error: 'Internal server error during deletion' }, 500)
  }
})

// ============================================================================
// OUTFITS / HISTORY ENDPOINTS
// ============================================================================

// GET /outfits/:device_uuid
app.get('/outfits/:device_uuid', async (c) => {
  const deviceUuid = c.req.param('device_uuid')

  const { data, error } = await supabase
    .from('outfits')
    .select('*')
    .eq('device_uuid', deviceUuid)
    .order('created_at', { ascending: false })

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  // Map to frontend format
  const formatted = data.map(item => ({
    ...item,
    prompt: item.rating_data?.redesign_prompt || '',
    status: item.status || 'rated'
  }))

  return c.json(formatted)
})

// ============================================================================
// REDESIGN ENDPOINTS
// ============================================================================

// GET /redesigns/status/:id
// If still processing, actively checks kie.ai and finalizes on completion.
app.get('/redesigns/status/:id', async (c) => {
  const id = c.req.param('id')

  const { data, error } = await supabase
    .from('outfits')
    .select('id, status, redesign_image_url, rating_data, device_uuid')
    .eq('id', id)
    .single()

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  // If still in-flight, check kie.ai and finalize if done
  if ((data.status === 'processing' || data.status === 'pending') && data.rating_data?.kie_task_id) {
    try {
      const kieResp = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${data.rating_data.kie_task_id}`, {
        headers: { 'Authorization': `Bearer ${KIE_API_KEY}` }
      })
      const kieResult = await kieResp.json()
      const state = kieResult?.data?.state ?? kieResult?.data?.status

      if (state === 'success' || state === 'succeeded') {
        const resultJsonRaw = kieResult?.data?.resultJson
        const resultJson = typeof resultJsonRaw === 'string' ? JSON.parse(resultJsonRaw) : resultJsonRaw
        const imageUrl = resultJson?.resultUrls?.[0]

        if (imageUrl) {
          // Download from kie.ai and re-upload to Supabase for permanent storage
          const finalResp = await fetch(imageUrl)
          const finalBlob = await finalResp.blob()
          const finalFilename = `redesign_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
          await supabase.storage.from('outfits').upload(finalFilename, finalBlob, { contentType: 'image/jpeg' })
          const { data: finalUrlData } = supabase.storage.from('outfits').getPublicUrl(finalFilename)
          const permanentUrl = finalUrlData.publicUrl

          await supabase.from('outfits').update({
            status: 'completed',
            redesign_image_url: permanentUrl,
            updated_at: new Date().toISOString()
          }).eq('id', id)

          return c.json({ id, status: 'completed', redesign_image_url: permanentUrl })
        }
      } else if (state === 'fail' || state === 'failed') {
        await supabase.from('outfits').update({ status: 'failed' }).eq('id', id)

        // Refund credit if not premium
        if (data.device_uuid) {
          const { data: user } = await supabase
            .from('users')
            .select('redesign_credits, is_premium')
            .eq('device_uuid', data.device_uuid)
            .single()
          if (user && !user.is_premium) {
            await supabase.from('users')
              .update({ redesign_credits: (user.redesign_credits || 0) + 1 })
              .eq('device_uuid', data.device_uuid)
          }
        }

        return c.json({ id, status: 'failed', redesign_image_url: null })
      }
    } catch (e) {
      console.warn(`[status] kie.ai check failed for ${id}:`, e)
    }
  }

  return c.json({ id: data.id, status: data.status, redesign_image_url: data.redesign_image_url })
})

// POST /redesigns/save-rating
app.post('/redesigns/save-rating', async (c) => {
  const { outfit_id, redesign_rating_data, redesign_image_url } = await c.req.json()

  if (!outfit_id || !redesign_rating_data) {
    return c.json({ error: 'Missing outfit_id or redesign_rating_data' }, 400)
  }

  const { data: outfit, error: fetchError } = await supabase
    .from('outfits')
    .select('id, rating_data, redesign_image_url, status')
    .eq('id', outfit_id)
    .single()

  if (fetchError || !outfit) {
    return c.json({ error: 'Outfit not found' }, 404)
  }

  const currentRatingData = outfit.rating_data && typeof outfit.rating_data === 'object' ? outfit.rating_data : {}
  const updatedRatingData = {
    ...currentRatingData,
    redesign_rating_data,
    redesign_rating_saved_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from('outfits')
    .update({
      rating_data: updatedRatingData,
      redesign_image_url: redesign_image_url || outfit.redesign_image_url,
      status: outfit.status === 'failed' ? outfit.status : (outfit.status || 'completed'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', outfit_id)

  if (updateError) {
    return c.json({ error: updateError.message }, 500)
  }

  return c.json({ success: true })
})

// POST /redesigns/create
app.post('/redesigns/create', async (c) => {
  const { outfit_id, redesign_prompt } = await c.req.json()

  console.log(`[redesigns/create] Request for outfit ${outfit_id}`)

  // 1. Get outfit and owner info
  const { data: outfit, error: outError } = await supabase
    .from('outfits')
    .select('device_uuid, original_image_url')
    .eq('id', outfit_id)
    .single()

  if (!outfit) {
    return c.json({ error: 'Outfit not found' }, 404)
  }

  const deviceUUID = outfit.device_uuid

  // 2. CHECK CREDITS / PREMIUM
  const { data: user } = await supabase
    .from('users')
    .select('is_premium, redesign_credits')
    .eq('device_uuid', deviceUUID)
    .single()

  if (user) {
    if (!user.is_premium && (user.redesign_credits || 0) <= 0) {
      return c.json({
        error: 'No redesign credits remaining',
        code: 'NO_CREDITS'
      }, 403)
    }

    // Deduct credit if not premium
    if (!user.is_premium) {
      await supabase
        .from('users')
        .update({ redesign_credits: (user.redesign_credits || 0) - 1 })
        .eq('device_uuid', deviceUUID)
      console.log(`[redesigns/create] Deducted credit for ${deviceUUID}`)
    }
  }

  // 3. Update status to pending
  await supabase
    .from('outfits')
    .update({ status: 'pending' })
    .eq('id', outfit_id)

  // 4. Submit to kie.ai and save taskId — polling happens via /redesigns/status/:id
  try {
    const taskId = await startRedesignTask(outfit_id, redesign_prompt, outfit.original_image_url)
    console.log(`[redesigns/create] kie.ai task started: ${taskId}`)
  } catch (e) {
    console.error('[redesigns/create] Failed to start kie.ai task:', e)
    await supabase.from('outfits').update({ status: 'failed' }).eq('id', outfit_id)
    // Refund credit
    if (user && !user.is_premium) {
      await supabase.from('users')
        .update({ redesign_credits: (user.redesign_credits || 0) + 1 })
        .eq('device_uuid', deviceUUID)
    }
    return c.json({ error: 'Failed to start redesign' }, 500)
  }

  return c.json({ data: { id: outfit_id, status: 'processing' } })
})

// ============================================================================
// RATE ENDPOINT (Image Upload)
// ============================================================================

app.post('/rate', async (c) => {
  console.log('[rate] Request received')

  try {
    const formData = await c.req.formData()
    const imageFile = formData.get('image') as File
    const profileJson = formData.get('profile') as string
    const context = formData.get('context') as string
    const deviceUuid = c.req.header('x-device-uuid')

    if (!imageFile) {
      return c.json({ error: 'No image file provided' }, 400)
    }

    // Convert File to buffer
    const arrayBuffer = await imageFile.arrayBuffer()
    const imageBuffer = new Uint8Array(arrayBuffer)

    // Parse profile if provided
    let profile = null
    if (profileJson) {
      try {
        profile = JSON.parse(profileJson)
      } catch (e) {
        console.warn('[rate] Failed to parse profile:', e)
      }
    }

    // Upload to Supabase Storage
    const filename = `original_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('outfits')
      .upload(filename, imageBuffer, { contentType: 'image/jpeg' })

    if (uploadError) {
      console.error('[rate] Storage upload failed:', uploadError)
      return c.json({ error: 'Failed to upload image' }, 500)
    }

    const { data: urlData } = supabase.storage.from('outfits').getPublicUrl(filename)
    const publicUrl = urlData.publicUrl

    // Build Style DNA context
    let profileContext = 'No user profile provided.'
    let styleGuidance = ''

    if (profile && typeof profile === 'object') {
      const dna = []
      if (profile.identity) dna.push(`- Identity: ${profile.identity}`)
      if (profile.age) dna.push(`- Age: ${profile.age}`)
      if (profile.goal) dna.push(`- Goal: They want to "${profile.goal}"`)

      const visualTaste = profile.visualTasteResults || profile.visualQuizResults
      if (Array.isArray(visualTaste)) {
        const likes = visualTaste
          .map((item: any) => typeof item === 'string' ? item : (item?.response === 'love' ? item.style : null))
          .filter(Boolean)
        if (likes.length) {
          dna.push(`- Style preferences: They like ${likes.join(', ')}.`)
        }
      }

      if (dna.length) {
        profileContext = `Use this Style DNA heavily in your critique:\n${dna.join('\n')}`
      }
    }

    // Convert image to base64 for OpenAI
    const base64Image = encodeBase64(imageBuffer)

    // Build context instruction
    let contextInstruction = ''
    if (context) {
      contextInstruction = `
IMPORTANT CONTEXT:
The user is dressing for: "${context}".
Adjust your rating and feedback to specifically address how well the outfit fits this occasion.
If the context is "ROAST ME", be extra savage and witty.
If the context is "DATE", focus on appeal and confidence.
If the context is "OFFICE", focus on professionalism.
`
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
  "potential_fix": "Post a real outfit pic.",
  "potential_score": 0,
  "subscores": [
    { "key": "aura", "label": "Aura", "score": 0, "insight": "N/A" },
    { "key": "fit", "label": "Fit", "score": 0, "insight": "N/A" },
    { "key": "palette", "label": "Palette", "score": 0, "insight": "N/A" },
    { "key": "trend", "label": "Trend", "score": 0, "insight": "N/A" }
  ]
}

**STEP 2: ANALYZE & INFER CONTEXT**
${contextInstruction ? contextInstruction : 'Since the user hasn\'t told you where they are going, LOOK at the outfit and guess.\n- Wearing a suit? Judge them on "Business/Formal."\n- Wearing sweats? Judge them on "Loungewear/Streetwear."'}

**STEP 3: THE GRADING CURVE**
* **0-49 (Cooked):** Fashion crimes.
* **50-69 (Mid):** The "NPC" zone. It’s fine. It covers your body.
* **70-89 (Valid):** Solid fit. Good proportions.
* **90-100 (God Tier):** Pinterest board worthy.

**STEP 4: GENERATE THE CONTENT**
* **Headline:** A 1-2 word brutal summary (e.g., "OFFICE DRONE", "NPC ENERGY", "ABSOLUTE CINEMA").
* **The W (Compliment):** One specific thing they did right (e.g., "Shoulder fit is actually solid.").
* **The L (Critique):** One specific thing they need to fix (e.g., "The skinny jeans are dating you. Burn them.").
* **Potential Fix:** A concrete, actionable step to improve the outfit (e.g., "Swap the skinny jeans for wide-leg cargo pants").
* **Potential Score:** The estimated score (0-100) if they make this specific change.

**STEP 5: DETAILED METRICS (0-100)**
1. **Aura**: The "vibe" score. Is it confident? Cool?
2. **Fit**: How well do the clothes sit on the body?
3. **Palette**: Color coordination and harmony.
4. **Trend**: How current is the look?

**USER STYLE DNA CONTEXT:**
${profileContext}

**JSON OUTPUT ONLY:**
You must provide your analysis in the strict JSON schema provided.`

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }],
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
                  description: 'THE W: A specific compliment about the outfit',
                },
                critique: {
                  type: 'string',
                  description: 'THE L: A specific critique about the outfit',
                },
                potential_fix: {
                  type: 'string',
                  description: 'Specific instruction on what to change to reach the potential score (e.g. "Swap the skinny jeans for wide-leg trousers")',
                },
                potential_score: {
                  type: 'number',
                  description: 'The projected score (0-100) if they make the fix',
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
              required: ['overall', 'compliment', 'critique', 'potential_fix', 'potential_score', 'subscores'],
              additionalProperties: false,
            }
          }
        }
      })
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('[rate] OpenAI error:', errorText)
      return c.json({ error: 'AI analysis failed' }, 500)
    }

    const openaiResult = await openaiResponse.json()
    const rawResult = JSON.parse(openaiResult.choices[0].message.content)

    // Map to frontend format (potential_fix -> redesign_prompt)
    const result = {
      ...rawResult,
      redesign_prompt: rawResult.potential_fix
    }

    // Save to database
    if (deviceUuid && publicUrl) {
      const { data: outfitData } = await supabase
        .from('outfits')
        .insert({
          device_uuid: deviceUuid,
          original_image_storage_path: filename,
          original_image_url: publicUrl,
          score: result.overall?.score,
          label: result.overall?.label,
          rating_data: result,
          status: 'rated',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (outfitData) {
        result.outfit_id = outfitData.id
        console.log(`[rate] Saved outfit ID: ${outfitData.id}`)
      }
    }

    return c.json(result)

  } catch (error: any) {
    console.error('[rate] Error:', error)
    return c.json({
      error: 'Failed to analyze outfit',
      message: error.message
    }, 500)
  }
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Submit image to kie.ai and save taskId to DB. Returns taskId.
async function startRedesignTask(outfitId: string, prompt: string, originalImageUrl: string): Promise<string> {
  await supabase.from('outfits').update({ status: 'processing' }).eq('id', outfitId)

  // Download original image and re-upload to Supabase (kie.ai needs a public URL)
  const resp = await fetch(originalImageUrl)
  if (!resp.ok) throw new Error('Failed to download original image')
  const imageBlob = await resp.blob()

  const filename = `redesign_input_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('outfits')
    .upload(filename, imageBlob, { contentType: 'image/jpeg' })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('outfits').getPublicUrl(filename)

  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIE_API_KEY}` },
    body: JSON.stringify({
      model: 'seedream/4.5-edit',
      input: { image_urls: [urlData.publicUrl], prompt, aspect_ratio: '9:16', quality: 'basic' }
    })
  })

  const createResult = await createResponse.json()
  if (createResult.code !== 200) throw new Error(`kie.ai create failed: ${createResult.message}`)

  const taskId = createResult.data.taskId

  // Persist taskId so /redesigns/status/:id can check it on each poll
  const { data: outfit } = await supabase.from('outfits').select('rating_data').eq('id', outfitId).single()
  const existingData = (outfit?.rating_data && typeof outfit.rating_data === 'object') ? outfit.rating_data : {}
  await supabase.from('outfits')
    .update({ rating_data: { ...existingData, kie_task_id: taskId } })
    .eq('id', outfitId)

  return taskId
}

// 404 handler - catch all unmatched routes
app.notFound((c) => {
  console.log(`[API] 404 - Route not found: ${c.req.method} ${c.req.path}`)
  return c.json({ error: 'Not Found', path: c.req.path }, 404)
})

// Start server with path rewriting
Deno.serve((req) => {
  const url = new URL(req.url)

  // Strip /api prefix (Supabase adds the function name as prefix)
  const originalPath = url.pathname
  if (url.pathname.startsWith('/api')) {
    url.pathname = url.pathname.replace(/^\/api/, '') || '/'
  }

  console.log(`[Server] Rewriting ${originalPath} -> ${url.pathname}`)

  // Create new request with modified URL
  const newReq = new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.body,
  })

  return app.fetch(newReq)
})

