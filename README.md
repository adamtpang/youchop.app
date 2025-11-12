# Chaptr - AI YouTube Chapters

Automatically chapterize YouTube videos with AI. Built with a viral credit-based growth model.

## 🚀 Product Overview

Chaptr is a Chrome extension that adds a "Chapterize" button to YouTube video pages. It uses AI to automatically generate chapters with timestamps, and features a credit-based economy where users can earn credits by posting chapters as comments.

### Key Features

- **AI-Powered Chapterization**: Uses Claude AI to analyze video transcripts and create perfect chapter breakpoints
- **Credit Economy**: Spend 1-3 credits to chapterize videos, earn +2 credits by posting comments
- **Viral Growth Loop**: Every comment includes "⚡ Auto-chapterized by chaptr.app"
- **Instant Caching**: Already chapterized videos load instantly for FREE
- **Referral System**: Earn +10 credits when friends sign up

## 🏗️ Tech Stack

- **Extension**: Chrome Manifest V3
- **Backend**: Next.js 14 + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude Sonnet 4.5
- **Payments**: Stripe
- **Hosting**: Vercel
- **APIs**: YouTube Data API v3, YouTube Transcript API

## 📦 Project Structure

```
youchop.app/
├── extension/              # Chrome extension
│   ├── manifest.json      # Extension manifest
│   ├── background.js      # Service worker
│   ├── content.js         # YouTube page injector
│   ├── content.css        # Extension styles
│   ├── popup.html         # Extension popup
│   ├── popup.js           # Popup logic
│   └── icons/             # Extension icons
├── app/                   # Next.js app
│   ├── api/              # API routes
│   │   ├── chapterize/   # Main chapterization endpoint
│   │   ├── comment/      # Comment posting
│   │   ├── credits/      # Credit management
│   │   ├── user/         # User endpoints
│   │   ├── auth/         # Authentication
│   │   └── webhooks/     # Stripe webhooks
│   ├── page.tsx          # Landing page
│   ├── credits/          # Credits purchase page
│   └── globals.css       # Global styles
├── lib/                  # Shared utilities
│   ├── supabase.ts       # Supabase client
│   ├── chapterize.ts     # AI chapterization logic
│   └── youtube.ts        # YouTube API helpers
├── supabase/
│   └── migrations/       # Database migrations
└── scripts/
    └── build-extension.js # Extension build script
```

## 🛠️ Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo>
cd youchop.app
npm install
```

### 2. Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# OpenAI (for Whisper fallback)
OPENAI_API_KEY=your_openai_api_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# YouTube Data API
YOUTUBE_API_KEY=your_youtube_api_key

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

Or manually run the SQL in `supabase/migrations/20240101000000_init_schema.sql` in your Supabase SQL editor.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Build Extension

```bash
npm run build:extension
```

This creates:
- `extension/build/` - Extension files ready to load in Chrome
- `extension.zip` - Ready for Chrome Web Store upload

### 6. Test Extension Locally

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/build` directory
5. Go to any YouTube video and test!

## 💳 Credit Economy

### Cost to Chapterize

- Short videos (<15 min): **1 credit**
- Medium videos (15-60 min): **2 credits**
- Long videos (60+ min): **3 credits**

### Ways to Earn Credits

- Sign up: **+5 credits**
- Post chapter comment: **+2 credits** (unlimited)
- Referral signup: **+10 credits**

### Credit Packages

- $5 = 25 credits (~10 hours)
- $10 = 60 credits (~25 hours) ⭐ MOST POPULAR
- $25 = 150 credits (~60 hours)
- $50 = 350 credits (~140 hours)

## 🎯 Viral Growth Loop

1. User chapterizes video (-1-3 credits)
2. Extension prompts: "Post as comment? Earn +2 credits!"
3. User posts → Gets net positive or breaks even
4. Comment includes "⚡ Auto-chapterized by chaptr.app"
5. New users discover tool → Repeat

## 🔑 API Endpoints

### POST /api/chapterize
Chapterize a video (with credit deduction and caching)

```json
{
  "video_id": "dQw4w9WgXcQ",
  "user_id": "uuid",
  "duration_seconds": 213
}
```

### POST /api/comment/post
Post chapters as YouTube comment (earn +2 credits)

```json
{
  "video_id": "dQw4w9WgXcQ",
  "user_id": "uuid",
  "chapters": [...],
  "youtube_token": "oauth_token"
}
```

### GET /api/user/credits?user_id=uuid
Get user's credit balance and stats

### GET /api/credits/estimate?video_duration_seconds=1800
Calculate credit cost for a video

### POST /api/credits/purchase
Create Stripe checkout session

## 📊 Database Schema

### users
- Credit balance and lifetime stats
- Referral tracking
- Stripe customer ID

### chapterized_videos
- Cached chapter data (video_id indexed)
- Access analytics
- Comment count

### credit_transactions
- Full audit trail of all credit movements
- Transaction types: signup_bonus, chapterize, comment_posted, referral, purchase

### user_video_interactions
- Tracks which users chapterized/commented on which videos

## 🚢 Deployment

### Backend (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Extension (Chrome Web Store)

1. Build extension: `npm run build:extension`
2. Create icons (16, 32, 48, 128px) in `extension/icons/`
3. Update `manifest.json` with OAuth client ID
4. Upload `extension.zip` to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

### Stripe Webhooks

1. Add webhook endpoint: `https://chaptr.app/api/webhooks/stripe`
2. Subscribe to events: `checkout.session.completed`
3. Copy webhook secret to `.env.local`

## 📈 Success Metrics

- **Comment Post Rate**: Target >40% of chapterizations
- **Viral Coefficient**: Users acquired per comment posted
- **Credit Purchase Conversion**: Target 15% of users
- **Cache Hit Rate**: Target >60% after first month
- **Referral Rate**: Target 20% signups from referrals

## 🔒 Security

- Row Level Security (RLS) enabled on all Supabase tables
- Credit transactions use PostgreSQL functions to prevent manipulation
- Stripe webhooks verified with signature
- YouTube OAuth tokens never stored, only used for API calls

## 🐛 Common Issues

### Extension not appearing on YouTube
- Check that content script matches YouTube URLs
- Ensure extension is enabled in Chrome
- Check console for errors

### "Insufficient credits" error
- User needs to purchase credits or earn more by commenting
- Check credit balance in popup

### Chapterization fails
- Verify Anthropic API key is valid
- Check video has transcript available
- Ensure video duration is provided

### Comment posting fails
- User needs to grant YouTube OAuth permissions
- Check that comments are enabled for the video
- Verify YouTube API quota

## 📝 TODO / Roadmap

### Phase 1 (Week 1) ✅
- [x] Chrome extension with credit display
- [x] Chapterize button with cost preview
- [x] Backend API with credit deduction
- [x] Database caching
- [x] Chapter display

### Phase 2 (Week 2)
- [ ] Comment posting with credit reward
- [ ] YouTube OAuth integration
- [ ] Stripe credit purchasing
- [ ] Usage analytics dashboard
- [ ] Referral code system

### Phase 3 (Week 3)
- [ ] Chrome Web Store submission
- [ ] Landing page launch
- [ ] Email drip campaign
- [ ] Analytics tracking (PostHog/Mixpanel)
- [ ] Social sharing features

### Future Enhancements
- [ ] Whisper API fallback for videos without transcripts
- [ ] Browser extension for Firefox/Edge
- [ ] Mobile app
- [ ] API for third-party integrations
- [ ] Team/Enterprise plans
- [ ] Custom branding options

## 🤝 Contributing

This is a private project. Contact the owner for contribution guidelines.

## 📄 License

All rights reserved. Proprietary software.

## 📧 Contact

For questions or support, visit [chaptr.app](https://chaptr.app) or email support@chaptr.app

---

Built with ⚡ by the Chaptr team
