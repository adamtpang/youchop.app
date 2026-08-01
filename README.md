# YouChop

**Real chapters for every YouTube video.** A Chrome extension that reads a video's transcript and renders AI-generated, clickable chapters in YouTube's own player UI (seekbar segments + chapter list), plus a creator service that chapterizes entire back-catalogs.

- Live site: https://youchop.app · Free one-video: https://youchop.app/chop · Creator offer: https://youchop.app/creators
- Company dashboard: [`vitals/index.html`](vitals/index.html) (open locally, or `/vitals` when deployed)
- Strategy: [STRATEGY.md](STRATEGY.md) · Growth: [GROWTH.md](GROWTH.md) · Numbers: [ECONOMICS.md](ECONOMICS.md) · Offer: [OFFER.md](OFFER.md)

## What's in this repo

| Path | What |
|---|---|
| `index.html` + `site.css` | Landing page (static, no build). Hero contains a CSS/JS animated demo of the seekbar getting chopped. |
| `chop.html` + `api/chapterize.js` | **Creator self-serve:** paste one YouTube URL → ready-to-paste description chapters. Transcript via Supadata/Apify; titles via Anthropic (if valid key) or free heuristic. |
| `extract.html` + `api/` | **Channel → Text** tool: search any channel, pull every video's transcript as copy-paste LLM context. Three Vercel functions, `channel-search.js` + `channel-videos.js` (free **YouTube Data API v3**, `YT_DATA_API_KEY`) and `transcripts.js` (pluggable: **Apify** free tier `APIFY_TOKEN` by default, `youtube-transcript.io` as paid fallback). All keys are free; see `.env.example`. Runs in mock mode without any key. |
| `creators.html` | The revenue surface: $99 back-catalog pack, $12/mo continuity sub, agency SKU, free-sample mechanic (links to `/chop`). |
| `vitals/` | The company operating dashboard (vendored from [vitals.run](https://vitals.run)). `vitals.data.js` is the single source of truth for metrics, roadmap, decisions. |
| `vercel.json` | Clean URLs (`/creators`, `/chop`), deployed to the existing `youchop.app` Vercel project. |

## Current state (2026-07-28)

**This is a rebuild.** The original Next.js app + extension source lived in `adamtpang/youchop.app` on GitHub, which was deleted; only the Vercel deployment survived (source unrecoverable for git deploys). Check [github.com/settings/deleted_repositories](https://github.com/settings/deleted_repositories), if the repo is still restorable, the extension source comes back with it.

- **Self-serve chapterize is live** at `/chop`, the post-upload path for Adam's essay videos and the free creator sample.
- Extension: built historically, **never published** to the Chrome Web Store; source lost pending repo restore (else rebuild). Do not block creator revenue on it.
- Business model: **creator-revenue-first**. Presell the $99 pack with manual fulfillment; `/chop` is the proof unit (**First Chapterize** activation metric, see `EVIDENCE.md`).

## Config swap-ins (search for these)

- `CHROME_STORE_URL` in `index.html`, set when the extension is published (until then the CTA degrades to an honest early-access mailto).
- `STRIPE_PACK_URL` in `creators.html`, set when the Stripe Payment Link exists (until then CTAs are mailto, which *is* the manual-fulfillment flow).

## Operating the dashboard

Open a Claude session in this repo and say: `log this week` · `check off <milestone>` · `set <metric> to N` · `add a decision`. Claude edits `vitals/vitals.data.js`; refresh `vitals/index.html`.

## Deploy

```
vercel --prod --scope adamtpangs-projects
```
The Vercel project `youchop.app` (`prj_wdbsn1IIESiWsAPGIw8JQDGf3Gz7`) already owns the domain. Note: deploying replaces the old Next.js app (including its `/credits` page).
