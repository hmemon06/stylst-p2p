# Supabase Edge Functions Setup

## 📁 Structure

```
supabase/functions/
├── api/           # Main API with Hono router (handles /user, /outfits, /redesigns)
├── revenuecat-webhook/  # RevenueCat webhook handler (already deployed)
└── rate/          # Placeholder (use Express backend for image uploads)
```

## 🚀 Deploy

### 1. Install Supabase CLI
```bash
npm install -g supabase
supabase login
```

### 2. Link Your Project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Set Environment Variables
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase secrets set KIE_AI_API_KEY=your-kie-key
```

### 4. Deploy Functions
```bash
# Deploy main API
supabase functions deploy api

# Deploy RevenueCat webhook (if not already deployed)
supabase functions deploy revenuecat-webhook
```

## 🔗 Endpoints

Once deployed, your API will be at:
```
https://YOUR_PROJECT.supabase.co/functions/v1/api
```

### Available Routes:
- `GET /health` - Health check
- `GET /user/stats/:device_uuid` - Get user stats
- `POST /user/reset-credits` - Reset credits (debug)
- `GET /outfits/:device_uuid` - Get outfit history
- `GET /redesigns/status/:id` - Check redesign status
- `POST /redesigns/create` - Start redesign job
- `POST /redesigns/save-rating` - Save redesign rating

## 📝 Notes

- The `/rate` endpoint (image uploads) should stay in your Express backend on Vercel
- The `api` function uses Hono for routing (single function, multiple routes)
- All functions automatically have access to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## 🧪 Testing

```bash
# Health check
curl https://YOUR_PROJECT.supabase.co/functions/v1/api/health

# Get user stats
curl https://YOUR_PROJECT.supabase.co/functions/v1/api/user/stats/test-uuid

# Get outfits
curl https://YOUR_PROJECT.supabase.co/functions/v1/api/outfits/test-uuid
```

## 🐛 Debugging

View logs:
```bash
supabase functions logs api --tail
```

Invoke locally:
```bash
supabase functions serve api
```

## 🔒 CORS

If you get CORS errors, add your app domain to:
**Supabase Dashboard** → **Authentication** → **URL Configuration** → **Site URL**

