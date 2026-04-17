# 🚀 Deployment Guide - Supabase + GitHub Pages

## Architecture

- **API Backend**: Supabase Edge Functions (single function with Hono router)
- **Everything**: All endpoints including image uploads are in Supabase Edge Functions
- **Legal Pages**: GitHub Pages (free static hosting)

---

## 1️⃣ Deploy Supabase Edge Function

### Install Supabase CLI
```bash
npm install -g supabase
supabase login
```

### Link to Your Project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Set Secrets
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase secrets set KIE_AI_API_KEY=your-kie-key
```

### Deploy the API Function
```bash
cd supabase/functions
supabase functions deploy api
```

Your API will be available at:
```
https://YOUR_PROJECT.supabase.co/functions/v1/api
```

### Test It
```bash
curl https://YOUR_PROJECT.supabase.co/functions/v1/api/health
```

---

## 2️⃣ Deploy Legal Pages to GitHub Pages

### Push `docs/` folder to GitHub
```bash
git add docs/
git commit -m "Add legal pages for GitHub Pages"
git push origin main
```

### Enable GitHub Pages
1. Go to your repo: **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** → Folder: **/docs**
4. Click **Save**

Your legal pages will be live at:
```
https://YOUR_USERNAME.github.io/stylst/privacy.html
https://YOUR_USERNAME.github.io/stylst/terms.html
```

### Update App Links
In `app/profile.tsx`, change URLs to:
```typescript
Linking.openURL('https://YOUR_USERNAME.github.io/stylst/privacy.html')
Linking.openURL('https://YOUR_USERNAME.github.io/stylst/terms.html')
```

---

## 3️⃣ Update App to Use New API

### In `lib/rater.ts`
Change the API base URL:

```typescript
// Old (local Express)
const RATER_URL = process.env.EXPO_PUBLIC_RATER_URL || 'http://localhost:3000';

// New (Supabase Edge Functions - everything!)
const API_URL = 'https://YOUR_PROJECT.supabase.co/functions/v1/api';
```

Update all endpoints to use the Edge Function:
```typescript
// User stats
await fetch(`${API_URL}/user/stats/${deviceUUID}`);

// Rate outfit (with image upload)
await fetch(`${API_URL}/rate`, {
  method: 'POST',
  body: formData,
});

// Outfits history
await fetch(`${API_URL}/outfits/${deviceUUID}`);

// Redesign creation
await fetch(`${API_URL}/redesigns/create`, { ... });
```

---

## 4️⃣ Environment Variables

### Supabase Secrets
```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set KIE_AI_API_KEY=...
```

That's it! No other services needed.

---

## 🔄 Workflow Summary

1. **User uploads photo** → Edge Function (`/api/rate`)
2. **User views stats** → Edge Function (`/api/user/stats/:uuid`)
3. **User views history** → Edge Function (`/api/outfits/:uuid`)
4. **User starts redesign** → Edge Function (`/api/redesigns/create`)
5. **User views legal pages** → GitHub Pages

**Everything runs on Supabase!** 🎉

---

## 📊 Cost Breakdown

| Service | Free Tier | What You Use |
|---------|-----------|--------------|
| **Supabase** | 500K Edge Function invocations/month | API calls + Image uploads |
| **GitHub Pages** | Unlimited static hosting | Legal pages |

**Total monthly cost**: $0 (on free tiers) 🎉

No Vercel needed!

---

## 🐛 Troubleshooting

### Edge Function Not Found
```bash
supabase functions list
supabase functions deploy api --verify-jwt false
```

### CORS Issues
Add your app's domain to Supabase **Authentication** → **URL Configuration** → **Site URL**

### Image Upload Fails
Check Edge Function logs:
```bash
supabase functions logs api --tail
```

---

## 🚀 Next Steps

1. Install Supabase CLI (see above for Windows instructions)
2. Deploy Edge Function: `supabase functions deploy api`
3. Enable GitHub Pages in repo settings
4. Update app URLs in `lib/rater.ts` and `app/profile.tsx`
5. Test everything in production!

**One service. One deployment. Simple.** 🎨

Good luck! 🎨

