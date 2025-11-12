# Chaptr Launch Checklist

Use this checklist to ensure everything is ready before launch.

## 🔧 Development Setup

- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Create `.env.local` from `.env.example`
- [ ] Fill in all environment variables

## 🗄️ Database Setup

- [ ] Create Supabase project
- [ ] Run database migration (`supabase db push` or manual SQL)
- [ ] Verify all 4 tables created:
  - [ ] users
  - [ ] chapterized_videos
  - [ ] credit_transactions
  - [ ] user_video_interactions
- [ ] Verify PostgreSQL functions work
- [ ] Test RLS policies
- [ ] Copy Supabase API keys to `.env.local`

## 🤖 API Keys Setup

### Anthropic Claude
- [ ] Sign up at console.anthropic.com
- [ ] Create API key
- [ ] Add to `.env.local` as `ANTHROPIC_API_KEY`
- [ ] Test with sample request

### YouTube Data API
- [ ] Create Google Cloud project
- [ ] Enable YouTube Data API v3
- [ ] Create API key
- [ ] Add to `.env.local` as `YOUTUBE_API_KEY`
- [ ] Create OAuth 2.0 Client ID
- [ ] Add client ID to `extension/manifest.json`
- [ ] Configure OAuth consent screen

### Stripe
- [ ] Create Stripe account
- [ ] Activate account (provide business info)
- [ ] Copy API keys (test mode first)
- [ ] Add to `.env.local`:
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Create products/prices in Stripe dashboard (optional)

### OpenAI (Optional)
- [ ] Sign up at platform.openai.com
- [ ] Add payment method
- [ ] Create API key
- [ ] Add to `.env.local` as `OPENAI_API_KEY`

## 🧪 Local Testing

### Backend Testing
- [ ] Run `npm run dev`
- [ ] Visit http://localhost:3000
- [ ] Verify landing page loads
- [ ] Test `/credits` page loads
- [ ] Check browser console for errors

### API Testing
- [ ] Test `/api/credits/estimate` endpoint
- [ ] Test user signup endpoint
- [ ] Test credit balance endpoint
- [ ] Test chapterization endpoint (may need user ID)

### Extension Testing
- [ ] Run `npm run build:extension`
- [ ] Load extension in Chrome (chrome://extensions)
- [ ] Go to YouTube video
- [ ] Verify Chapterize button appears
- [ ] Test authentication flow
- [ ] Test chapterization (will need all APIs working)
- [ ] Test comment posting
- [ ] Verify popup shows credit balance

## 🎨 Assets & Branding

### Extension Icons
- [ ] Create icon 16x16 px
- [ ] Create icon 32x32 px
- [ ] Create icon 48x48 px
- [ ] Create icon 128x128 px
- [ ] Save all as PNG in `extension/icons/`
- [ ] Rebuild extension

### Chrome Web Store Assets
- [ ] Take 5-6 screenshots of extension in action
- [ ] Create promotional image 440x280 px
- [ ] Create promotional image 920x680 px
- [ ] Create promotional image 1400x560 px (optional)
- [ ] Record demo video (optional but recommended)

### Website Assets
- [ ] Create logo/favicon
- [ ] Create og-image.png (1200x630) for social sharing
- [ ] Add to `/public` directory
- [ ] Update metadata in `app/layout.tsx`

## 📄 Legal & Policy Pages

- [ ] Write Privacy Policy
- [ ] Write Terms of Service
- [ ] Create `/app/privacy/page.tsx`
- [ ] Create `/app/terms/page.tsx`
- [ ] Update footer links
- [ ] Add cookie consent if needed (GDPR)

## 🚀 Deployment

### Vercel Deployment
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Login: `vercel login`
- [ ] Deploy test: `vercel`
- [ ] Test deployment URL
- [ ] Deploy production: `vercel --prod`
- [ ] Add all environment variables in Vercel dashboard
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain

### Domain Setup
- [ ] Purchase domain (chaptr.app or your choice)
- [ ] Add domain in Vercel dashboard
- [ ] Configure DNS records
- [ ] Wait for DNS propagation
- [ ] Verify SSL certificate active
- [ ] Test https://chaptr.app loads

### Stripe Webhook Setup
- [ ] Go to Stripe Dashboard → Developers → Webhooks
- [ ] Add endpoint: `https://chaptr.app/api/webhooks/stripe`
- [ ] Select event: `checkout.session.completed`
- [ ] Copy webhook signing secret
- [ ] Add to Vercel environment variables
- [ ] Redeploy: `vercel --prod`
- [ ] Test webhook with Stripe CLI or test payment

## 📱 Chrome Web Store Submission

### Preparation
- [ ] Update `extension/background.js` API_URL to production
- [ ] Update manifest.json OAuth client ID
- [ ] Final build: `npm run build:extension`
- [ ] Test extension with production API
- [ ] Prepare extension description (copy from manifest)

### Submission
- [ ] Go to Chrome Web Store Developer Dashboard
- [ ] Pay $5 developer fee (one-time)
- [ ] Click "New Item"
- [ ] Upload `extension.zip`
- [ ] Fill out store listing:
  - [ ] Name: Chaptr - AI YouTube Chapters
  - [ ] Short description (132 chars max)
  - [ ] Detailed description
  - [ ] Category: Productivity
  - [ ] Language: English
  - [ ] Upload screenshots
  - [ ] Upload promotional images
  - [ ] Privacy policy URL
  - [ ] Permissions justification
- [ ] Submit for review
- [ ] Wait 1-3 days for approval

### Post-Approval
- [ ] Copy Extension ID from Chrome Web Store URL
- [ ] Update OAuth client in Google Cloud Console
- [ ] Test installation from Chrome Web Store
- [ ] Share extension link

## 🧪 Production Testing

### End-to-End Flow
- [ ] Install extension from Chrome Web Store
- [ ] Sign up and verify 5 free credits received
- [ ] Go to short YouTube video (<15 min)
- [ ] Click Chapterize button
- [ ] Verify credits deducted (1 credit)
- [ ] Review generated chapters
- [ ] Post as comment
- [ ] Verify +2 credits earned
- [ ] Check comment appears on YouTube
- [ ] Test same video with another account (should be FREE/cached)

### Payment Testing
- [ ] Click "Purchase Credits"
- [ ] Select $10 package
- [ ] Complete Stripe checkout (use test card: 4242 4242 4242 4242)
- [ ] Verify redirect to success page
- [ ] Check credits added to balance
- [ ] Verify transaction in Stripe dashboard
- [ ] Test with real card (small amount)

### Referral Testing
- [ ] Get referral code from extension popup
- [ ] Share with test account
- [ ] Sign up using referral code
- [ ] Verify original user got +10 credits
- [ ] Verify new user got +5 credits

## 📊 Analytics & Monitoring

- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Set up analytics (PostHog, Mixpanel, Google Analytics)
- [ ] Add tracking events:
  - [ ] Extension installed
  - [ ] User signed up
  - [ ] Video chapterized
  - [ ] Comment posted
  - [ ] Credits purchased
  - [ ] Referral used
- [ ] Set up Supabase monitoring
- [ ] Set up Vercel monitoring
- [ ] Create dashboard for key metrics

## 🔔 User Communication

### Email System (Optional but Recommended)
- [ ] Set up email service (SendGrid, Postmark, Resend)
- [ ] Create welcome email template
- [ ] Create credit reminder template
- [ ] Create purchase confirmation template
- [ ] Set up email automation triggers

### Support Channels
- [ ] Create support email (support@chaptr.app)
- [ ] Set up Discord server (optional)
- [ ] Create FAQ page
- [ ] Add support link in extension
- [ ] Create feedback form

## 📣 Marketing & Launch

### Pre-Launch
- [ ] Create Twitter/X account
- [ ] Create LinkedIn page
- [ ] Write launch blog post
- [ ] Prepare Product Hunt submission
- [ ] Create demo video for YouTube
- [ ] Reach out to YouTuber influencers
- [ ] Prepare press kit

### Launch Day
- [ ] Submit to Product Hunt
- [ ] Post on Twitter/X
- [ ] Post on LinkedIn
- [ ] Post on Reddit (r/Chrome, r/youtube)
- [ ] Post on Hacker News
- [ ] Email interested beta users
- [ ] Update personal social media

### Post-Launch
- [ ] Monitor user feedback
- [ ] Respond to reviews
- [ ] Track key metrics daily
- [ ] Iterate based on feedback
- [ ] Plan first feature update

## 🐛 Bug Monitoring

### Common Issues to Watch
- [ ] YouTube API quota exceeded
- [ ] Stripe webhook failures
- [ ] Database connection issues
- [ ] Extension not loading on YouTube
- [ ] OAuth flow failures
- [ ] Credit calculation errors

### Monitoring Checklist
- [ ] Check Vercel logs daily
- [ ] Check Supabase logs daily
- [ ] Check Stripe webhook logs
- [ ] Check Chrome Web Store reviews
- [ ] Check error tracking dashboard
- [ ] Monitor user support emails

## 💼 Business Setup

- [ ] Register business entity (if needed)
- [ ] Open business bank account
- [ ] Set up accounting system
- [ ] File necessary business licenses
- [ ] Get business insurance (if needed)
- [ ] Set up invoicing system

## 📈 Success Metrics Tracking

Week 1 Goals:
- [ ] 100 extension installs
- [ ] 50 videos chapterized
- [ ] 20% comment post rate
- [ ] 5% credit purchase rate

Month 1 Goals:
- [ ] 1,000 extension installs
- [ ] 500 videos chapterized
- [ ] 40% comment post rate
- [ ] 15% credit purchase rate
- [ ] 60% cache hit rate
- [ ] $500 in revenue

## 🎯 Next Features to Build

Priority 1 (Week 3-4):
- [ ] Admin dashboard for analytics
- [ ] Email notification system
- [ ] Whisper API fallback
- [ ] Referral dashboard in extension

Priority 2 (Month 2):
- [ ] Social sharing features
- [ ] Video collections
- [ ] Chapter editing
- [ ] API documentation

Priority 3 (Future):
- [ ] Mobile app
- [ ] Firefox extension
- [ ] Team plans
- [ ] White-label offering

## ✅ Final Pre-Launch Check

- [ ] All API keys configured and working
- [ ] Database migrations run successfully
- [ ] Extension loads without errors
- [ ] Can chapterize videos end-to-end
- [ ] Can post comments and earn credits
- [ ] Can purchase credits via Stripe
- [ ] Landing page looks professional
- [ ] All links work
- [ ] Mobile responsive
- [ ] SEO metadata set
- [ ] Privacy policy live
- [ ] Terms of service live
- [ ] Support email working
- [ ] Analytics tracking active
- [ ] Error monitoring active

## 🚀 LAUNCH!

Once all items above are checked, you're ready to launch!

**Launch Sequence:**
1. Submit extension to Chrome Web Store (wait for approval)
2. Deploy to production (Vercel)
3. Test everything end-to-end
4. Announce on all channels
5. Monitor metrics closely
6. Respond to feedback quickly
7. Iterate and improve

**Remember:**
- Ship early, iterate fast
- User feedback is gold
- Monitor metrics daily
- Celebrate small wins
- Stay focused on core value: helping people navigate YouTube videos better

---

Good luck! 🎉 You've got this! 🚀
