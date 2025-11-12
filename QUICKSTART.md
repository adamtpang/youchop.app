# Chaptr Quickstart Guide

Get Chaptr running locally in under 30 minutes!

## Prerequisites

- Node.js 18+ installed
- Chrome browser
- Git installed

## Step 1: Install Dependencies (2 minutes)

```bash
cd /home/adampangelinan/ubuntu-projects/youchop.app
npm install
```

## Step 2: Set Up Supabase (5 minutes)

### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up / Log in
3. Click "New Project"
4. Wait 2 minutes for initialization

### Run Migration
Copy the SQL from `supabase/migrations/20240101000000_init_schema.sql` and paste into Supabase SQL Editor, then click Run.

### Get API Keys
In Supabase dashboard → Settings → API:
- Copy Project URL
- Copy `anon` public key
- Copy `service_role` secret key

## Step 3: Get Anthropic API Key (3 minutes)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / Log in
3. Go to API Keys → Create Key
4. Copy the key

## Step 4: Get YouTube API Key (5 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project
3. Enable "YouTube Data API v3"
4. Create Credentials → API Key
5. Copy the key

## Step 5: Create .env.local (2 minutes)

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```bash
# Supabase (from Step 2)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Anthropic (from Step 3)
ANTHROPIC_API_KEY=sk-ant-...

# YouTube (from Step 4)
YOUTUBE_API_KEY=AIza...

# Stripe (skip for now, will add later)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI (optional, skip for now)
OPENAI_API_KEY=sk-proj-...

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 6: Run Development Server (1 minute)

```bash
npm run dev
```

Open http://localhost:3000 - you should see the landing page!

## Step 7: Build & Test Extension (5 minutes)

```bash
npm run build:extension
```

### Load in Chrome
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select `extension/build` folder
6. Extension icon should appear in Chrome toolbar

### Test on YouTube
1. Go to any YouTube video
2. Look for the "⚡ Chapterize" button in video controls
3. Click it!

**Note:** You'll need to implement authentication first to actually chapterize videos.

## Step 8: Quick Test API (3 minutes)

### Test Credit Estimate
```bash
curl "http://localhost:3000/api/credits/estimate?video_duration_seconds=1800"
```

Should return:
```json
{
  "credits_required": 2,
  "duration_seconds": 1800,
  "duration_minutes": 30
}
```

### Test User Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Should create user and return:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "test@example.com",
    "credits_balance": 5
  }
}
```

## Next Steps

### To Complete Local Setup:

1. **Add Stripe** (for credit purchases)
   - Sign up at stripe.com
   - Get test API keys
   - Add to `.env.local`

2. **Add YouTube OAuth** (for comment posting)
   - Create OAuth client in Google Cloud Console
   - Update `extension/manifest.json` with client ID

3. **Add Authentication** (for production)
   - Implement proper auth flow
   - Currently uses placeholder user IDs

### To Deploy to Production:

See `SETUP.md` for complete deployment guide:
- Deploy backend to Vercel
- Set up production Stripe webhook
- Submit extension to Chrome Web Store

### To Launch:

See `LAUNCH_CHECKLIST.md` for complete launch checklist.

## Troubleshooting

### "Module not found" errors
```bash
npm install
```

### Extension not loading
- Make sure you ran `npm run build:extension`
- Check that `extension/build` folder exists
- Try reloading extension in chrome://extensions

### API errors
- Check `.env.local` has all required keys
- Verify keys don't have extra spaces
- Make sure Supabase migration ran successfully

### Database errors
- Go to Supabase dashboard → SQL Editor
- Verify all 4 tables exist
- Re-run migration if needed

## Get Help

- Full documentation: `README.md`
- Setup guide: `SETUP.md`
- Launch checklist: `LAUNCH_CHECKLIST.md`
- Project summary: `PROJECT_SUMMARY.md`

## What You Built

✅ Chrome extension with viral credit economy
✅ Next.js backend with AI chapterization
✅ Supabase database with credit tracking
✅ Stripe payment integration
✅ YouTube API integration
✅ Complete landing page

**Total time to working prototype: ~30 minutes**

**Total time to production launch: ~2 weeks**

Now go build something amazing! 🚀
