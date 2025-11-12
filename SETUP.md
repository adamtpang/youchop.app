# Chaptr Setup Guide

Complete step-by-step setup instructions for deploying Chaptr.

## Prerequisites

- Node.js 18+ installed
- Chrome browser for testing
- Git installed
- Accounts needed:
  - [Supabase](https://supabase.com) (free tier)
  - [Anthropic](https://console.anthropic.com) (API access)
  - [Google Cloud Console](https://console.cloud.google.com) (YouTube API)
  - [Stripe](https://stripe.com) (payments)
  - [Vercel](https://vercel.com) (hosting - free tier)

## Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd youchop.app
npm install
```

## Step 2: Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and region
4. Set database password (save it!)
5. Wait for project to initialize (~2 minutes)

### Run Database Migrations

Option A - Using Supabase CLI (recommended):

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

Option B - Manual SQL:

1. Open your Supabase project dashboard
2. Go to "SQL Editor"
3. Copy contents of `supabase/migrations/20240101000000_init_schema.sql`
4. Paste and run the SQL

### Get API Keys

1. In Supabase dashboard, go to "Settings" → "API"
2. Copy these values to `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret!

## Step 3: Anthropic Claude API

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to "API Keys"
4. Click "Create Key"
5. Copy key to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

## Step 4: YouTube Data API

### Enable API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Go to "APIs & Services" → "Library"
4. Search "YouTube Data API v3"
5. Click "Enable"

### Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy key to `.env.local`:
   ```
   YOUTUBE_API_KEY=AIza...
   ```

### Create OAuth Client (for comment posting)

1. In "Credentials", click "Create Credentials" → "OAuth 2.0 Client ID"
2. Configure OAuth consent screen if prompted
3. Application type: "Chrome Extension"
4. Add authorized origins:
   - `chrome-extension://YOUR_EXTENSION_ID` (get this after publishing)
5. Copy Client ID
6. Update `extension/manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/youtube.force-ssl"]
   }
   ```

## Step 5: Stripe Setup

### Create Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up for account
3. Activate account (may need to provide business info)

### Get API Keys

1. In Stripe dashboard, click "Developers" → "API keys"
2. Copy to `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_... (use sk_live_... for production)
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

### Setup Webhook (after deploying to Vercel)

1. In Stripe dashboard, go to "Developers" → "Webhooks"
2. Click "Add endpoint"
3. URL: `https://chaptr.app/api/webhooks/stripe`
4. Events to send: `checkout.session.completed`
5. Copy webhook signing secret:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## Step 6: OpenAI API (Optional - Whisper Fallback)

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account and add payment method
3. Go to "API Keys"
4. Create new key
5. Copy to `.env.local`:
   ```
   OPENAI_API_KEY=sk-proj-...
   ```

## Step 7: Complete .env.local

Your final `.env.local` should look like:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (optional)
OPENAI_API_KEY=sk-proj-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# YouTube Data API
YOUTUBE_API_KEY=AIza...

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 8: Test Locally

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

### Test Extension Locally

```bash
# Build extension
npm run build:extension

# Load in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select extension/build directory
# 5. Go to YouTube and test!
```

## Step 9: Deploy to Vercel

### Install Vercel CLI

```bash
npm install -g vercel
```

### Login and Deploy

```bash
# Login
vercel login

# Deploy
vercel --prod
```

### Add Environment Variables in Vercel

1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add all variables from `.env.local`
3. Make sure to use production keys (not test keys)
4. Update `NEXT_PUBLIC_APP_URL` to your production domain

### Setup Custom Domain

1. In Vercel dashboard, go to "Domains"
2. Add `chaptr.app` (or your domain)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (~1 hour)

## Step 10: Publish Chrome Extension

### Prepare Extension

1. Create icon images (16x16, 32x32, 48x48, 128x128 px)
2. Save as PNG in `extension/icons/`
3. Update `extension/background.js`:
   ```javascript
   const API_URL = 'https://chaptr.app'; // Change from localhost
   ```
4. Rebuild:
   ```bash
   npm run build:extension
   ```

### Submit to Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 developer fee
3. Click "New Item"
4. Upload `extension.zip`
5. Fill out listing:
   - Name: Chaptr - AI YouTube Chapters
   - Description: (copy from manifest)
   - Category: Productivity
   - Screenshots: Take 5-6 screenshots showing the extension in action
   - Promotional images: 440x280 and 920x680
   - Privacy policy URL: https://chaptr.app/privacy
6. Submit for review (takes 1-3 days)

### After Approval

1. Copy Extension ID from Chrome Web Store
2. Update OAuth client in Google Cloud Console with real extension ID
3. Update `extension/manifest.json` if needed
4. Submit update if OAuth client ID changed

## Step 11: Setup Stripe Webhook (Production)

Now that you have production URL:

1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://chaptr.app/api/webhooks/stripe`
3. Select event: `checkout.session.completed`
4. Copy webhook secret
5. Add to Vercel environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
6. Redeploy: `vercel --prod`

## Step 12: Test End-to-End

### Test Flow

1. Install extension from Chrome Web Store
2. Go to YouTube video
3. Click Chapterize button
4. Should authenticate and get 5 free credits
5. Chapterize a video
6. Post as comment
7. Verify +2 credits earned
8. Test credit purchase
9. Verify Stripe payment works

### Monitor Logs

- **Supabase**: Dashboard → Logs
- **Vercel**: Dashboard → Your Project → Logs
- **Stripe**: Dashboard → Developers → Logs
- **Chrome Extension**: DevTools Console

## Troubleshooting

### Database Migration Fails

- Check Supabase project is active
- Verify you have correct permissions
- Run SQL manually in Supabase SQL Editor

### API Key Errors

- Verify all keys are in `.env.local`
- Check keys don't have extra spaces
- Make sure using correct environment (test vs production)

### Extension Not Loading

- Check manifest.json is valid JSON
- Verify all required files exist in build/
- Check Chrome DevTools for errors
- Reload extension after changes

### YouTube API Quota Exceeded

- Default quota: 10,000 units/day
- Comment posting costs 50 units
- Request quota increase in Google Cloud Console if needed

### Stripe Webhook Not Working

- Check webhook URL is correct
- Verify webhook secret matches
- Test webhook in Stripe dashboard
- Check Vercel logs for errors

## Next Steps

1. Set up analytics (PostHog, Mixpanel, or Google Analytics)
2. Create email drip campaign (welcome emails, credit reminders)
3. Build referral system UI in extension popup
4. Monitor metrics and iterate
5. Plan marketing launch

## Support

- Documentation: [chaptr.app/docs](https://chaptr.app/docs)
- GitHub Issues: Create issue in repo
- Email: support@chaptr.app

---

🎉 Congratulations! Chaptr is now live!
