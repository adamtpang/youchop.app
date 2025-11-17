# Deployment Guide for Chaptr

The Vercel CLI is now installed. Follow these steps to deploy:

## Step 1: Login to Vercel

```bash
vercel login
```

This will open your browser for authentication. Choose your login method (GitHub, GitLab, Bitbucket, or Email).

## Step 2: Initial Deployment

```bash
cd /home/adampangelinan/ubuntu-projects/youchop.app
vercel
```

You'll be asked:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No (first time)
- **Project name?** → chaptr (or press Enter for default)
- **Directory?** → Press Enter (use current directory)
- **Override settings?** → No

This will deploy to a preview URL first.

## Step 3: Add Environment Variables

Go to your Vercel dashboard: https://vercel.com/dashboard

1. Click on your **chaptr** project
2. Go to **Settings** → **Environment Variables**
3. Add each variable (click "Add New"):

### Required Variables:

```
NEXT_PUBLIC_SUPABASE_URL
Value: [Your Supabase project URL]
Environment: Production, Preview, Development

NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Your Supabase anon key]
Environment: Production, Preview, Development

SUPABASE_SERVICE_ROLE_KEY
Value: [Your Supabase service role key]
Environment: Production (only - this is secret!)

ANTHROPIC_API_KEY
Value: [Your Anthropic API key]
Environment: Production

STRIPE_SECRET_KEY
Value: [Your Stripe secret key - use sk_live_ for production]
Environment: Production

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
Value: [Your Stripe publishable key - use pk_live_ for production]
Environment: Production, Preview, Development

STRIPE_WEBHOOK_SECRET
Value: [Will get this after setting up webhook - add later]
Environment: Production

YOUTUBE_API_KEY
Value: [Your YouTube Data API key]
Environment: Production

NEXT_PUBLIC_APP_URL
Value: https://your-project.vercel.app (or your custom domain)
Environment: Production, Preview, Development
```

### Optional Variables:

```
OPENAI_API_KEY
Value: [Your OpenAI API key]
Environment: Production
```

## Step 4: Deploy to Production

After adding all environment variables:

```bash
vercel --prod
```

This will:
- Build your Next.js app
- Deploy to production
- Give you a production URL

## Step 5: Set Up Custom Domain (Optional)

1. In Vercel dashboard → Your Project → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain: `chaptr.app`
4. Follow DNS configuration instructions
5. Wait for DNS propagation (usually 1-2 hours)

### DNS Configuration Example:

If using chaptr.app, add these DNS records:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## Step 6: Update Environment Variables

After getting your production URL, update:

```
NEXT_PUBLIC_APP_URL=https://chaptr.app
```

Then redeploy:

```bash
vercel --prod
```

## Step 7: Set Up Stripe Webhook

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://chaptr.app/api/webhooks/stripe`
4. Events to listen to: `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add to Vercel environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
7. Redeploy: `vercel --prod`

## Step 8: Update Extension

Once deployed, update your extension to use production API:

1. Edit `extension/background.js`:
   ```javascript
   const API_URL = 'https://chaptr.app'; // Change from localhost
   ```

2. Rebuild extension:
   ```bash
   npm run build:extension
   ```

## Step 9: Test Production Deployment

1. Visit your production URL
2. Check landing page loads
3. Test API endpoints:
   ```bash
   curl "https://chaptr.app/api/credits/estimate?video_duration_seconds=1800"
   ```

## Quick Commands Reference

```bash
# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# List all deployments
vercel ls

# Add environment variable via CLI
vercel env add VARIABLE_NAME production
```

## Troubleshooting

### Build Fails

Check Vercel build logs for specific errors:
- Missing dependencies? Run `npm install` locally first
- TypeScript errors? Run `npm run build` locally to debug

### API Routes Return 500

- Check environment variables are set correctly
- View runtime logs in Vercel dashboard
- Verify database migration ran successfully

### Extension Can't Connect

- Check CORS headers in `next.config.js`
- Verify production URL in extension's `background.js`
- Check browser console for errors

## Deployment Checklist

- [ ] Vercel CLI installed
- [ ] Logged into Vercel
- [ ] Initial deployment successful
- [ ] All environment variables added
- [ ] Production deployment successful
- [ ] Custom domain configured (optional)
- [ ] Stripe webhook configured
- [ ] Extension updated with production URL
- [ ] End-to-end testing complete

## Next Steps After Deployment

1. Submit extension to Chrome Web Store
2. Set up monitoring/analytics
3. Configure email system (optional)
4. Test payment flow end-to-end
5. Launch! 🚀

---

Need help? Check the logs:
- Vercel build logs: Dashboard → Your Project → Deployments
- Runtime logs: `vercel logs` or in dashboard
- Database logs: Supabase Dashboard → Logs
