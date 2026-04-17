// This endpoint is now handled by the main /api function with Hono
// Just redirect requests there

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  return new Response(
    JSON.stringify({ 
      error: 'Use /api/rate endpoint instead',
      message: 'This endpoint has moved to the main API function at /api/rate'
    }),
    { 
      status: 301,
      headers: { 
        'Content-Type': 'application/json',
        'Location': '/api/rate'
      }
    }
  )
})

