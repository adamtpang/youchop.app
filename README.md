# YouChop

**Real chapters for every YouTube video.** A Chrome extension that reads a video's transcript and renders AI-generated, clickable chapters in YouTube's own player UI (seekbar segments + chapter list), plus a creator service that chapterizes entire back-catalogs.

- Live site: https://youchop.app · Free one-video: https://youchop.app/chop · Creator offer: https://youchop.app/creators
- Company dashboard: [`vitals/index.html`](vitals/index.html) (open locally, or `/vitals` when deployed)
- Strategy: [STRATEGY.md](STRATEGY.md) · Growth: [GROWTH.md](GROWTH.md) · Numbers: [ECONOMICS.md](ECONOMICS.md) · Offer: [OFFER.md](OFFER.md)

## What's in this repo

| Path | What |
|---|---|
| `index.html` + `site.css` | Landing page (static, no build). Hero contains a CSS/JS animated demo of the seekbar getting chopped. |
| `extension/` | **Local video and playlist chopping:** extracts through YouTube in the user's browser and exports clean text, timestamps, or one linked Markdown file per video. Playlist runs process up to 50 public or signed-in private videos in temporary inactive tabs. |
| `chop.html` + `api/chapterize.js` | **Creator self-serve:** paste one YouTube URL → ready-to-paste description chapters. Web requests use Supadata/Apify; extension requests reuse local timestamp rows. Titles use Anthropic when enabled or the free heuristic. |
| `extract.html` + `api/` | **Channel or playlist → Text** tool: search a channel or paste a public playlist, then pull transcripts as copy-paste LLM context. Listing uses keyless YouTube pages with an optional Data API fallback; hosted transcript providers remain available to the web tool. |
| `creators.html` | The revenue surface: $99 back-catalog pack, $12/mo continuity sub, agency SKU, free-sample mechanic (links to `/chop`). |
| `vitals/` | The company operating dashboard (vendored from [vitals.run](https://vitals.run)). `vitals.data.js` is the single source of truth for metrics, roadmap, decisions. |
| `vercel.json` | Clean URLs (`/creators`, `/chop`), deployed to the existing `youchop.app` Vercel project. |

## Current state (2026-07-28)

**This is a rebuild.** The original Next.js app + extension source lived in `adamtpang/youchop.app` on GitHub, which was deleted; only the Vercel deployment survived (source unrecoverable for git deploys). Check [github.com/settings/deleted_repositories](https://github.com/settings/deleted_repositories), if the repo is still restorable, the extension source comes back with it.

- **Self-serve chapterize is live** at `/chop`, the post-upload path for Adam's essay videos and the free creator sample.
- Extension: rebuilt locally and **not yet published** to the Chrome Web Store. v0.11.0 supports one-video and public/private playlist transcript extraction plus chapter generation from locally extracted rows. Successful browser transcripts are saved on-device for 90 days, so repeat video and playlist chops can skip extraction. Provider-fetched public transcripts are cached by video and language for 30 days in Vercel Runtime Cache once this version is deployed. Failures and browser-local/private transcript text are not added to the shared cache. Playlist results expose one independently selectable, copyable, and downloadable Markdown file per video. Playlist pages receive a visible **Chop playlist** button, the chapterize button appears only on videos without existing chapters, generation covers the full transcript without a 20-chapter ceiling, and attributed output includes `https://youchop.app`.
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
