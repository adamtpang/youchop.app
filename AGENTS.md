<!-- BEGIN:claude-chat-continuation -->
Claude chat continuation: read `CODEX_CONTINUE_FROM_CLAUDE.md` to resume from the latest local Claude Code sessions for this project.
<!-- END:claude-chat-continuation -->

<!-- BEGIN:claude-codex-sync -->
# Claude/Codex sync

Before making changes, read `CLAUDE.md` in this project if it exists. It is the live handoff from Claude Code and the source of truth for current project progress, design decisions, constraints, and open tasks. Keep future progress updates there so Claude and Codex stay in sync.

If this file contains older project context that conflicts with `CLAUDE.md`, prefer `CLAUDE.md` unless the user says otherwise.
<!-- END:claude-codex-sync -->

<!-- BEGIN:imported-claude-context -->
# CLAUDE.md - youchop.app

Context for Claude Code, Codex, and humans working in this folder.

## What this is

This handoff was generated on 2026-07-07 so every top-level Codex project under
`C:\Users\adamp\OneDrive\Aether` has both `CLAUDE.md` and `AGENTS.md`.

No richer Claude handoff was found here during the workspace sync. Treat this file
as a starting point, then inspect the actual code and docs before making changes.

## Detected project facts

- Workspace folder: `youchop.app`
- Git repository: yes
- `package.json`: no
- Detected stack: static HTML
- Existing context-like files: README.md, readme.md, llms.txt
- Notable top-level files: .env.example, .gitignore, creators.html, ECONOMICS.md, extract.html, GROWTH.md, index.html, llms.txt, README.md, site.css, STRATEGY.md, vercel.json

## How to keep this useful

- If you learn the product purpose, stack, run commands, deployment target, or open
  tasks, update this file.
- Keep `AGENTS.md` synchronized with this file so Codex sessions have the same
  context inline.
- Prefer concrete project facts over generic instructions.

## Imported existing context

Source: `README.md`

```markdown
# YouChop

**Real chapters for every YouTube video.** A Chrome extension that reads a video's transcript and renders AI-generated, clickable chapters in YouTube's own player UI (seekbar segments + chapter list) — plus a creator service that chapterizes entire back-catalogs.

- Live site: https://youchop.app · Creator offer: https://youchop.app/creators
- Company dashboard: [`vitals/index.html`](vitals/index.html) (open locally, or `/vitals` when deployed)
- Strategy: [STRATEGY.md](STRATEGY.md) · Growth: [GROWTH.md](GROWTH.md) · Numbers: [ECONOMICS.md](ECONOMICS.md)

## What's in this repo

| Path | What |
|---|---|
| `index.html` + `site.css` | Landing page (static, no build). Hero contains a CSS/JS animated demo of the seekbar getting chopped. |
| `extract.html` + `api/` | **Channel → Text** tool: pull a whole channel's transcripts as copy-paste LLM context. Two Vercel functions (`channel-videos.js`, `transcripts.js`) proxy youtube-transcript.io with the token kept server-side. Needs `YT_TRANSCRIPT_TOKEN` (see `.env.example`); runs in mock mode without one. |
| `creators.html` | The revenue surface: $99 back-catalog pack, $12/mo continuity sub, agency SKU, free-sample mechanic. |
| `vitals/` | The company operating dashboard (vendored from [vitals.run](https://vitals.run)). `vitals.data.js` is the single source of truth for metrics, roadmap, decisions. |
| `vercel.json` | Clean URLs (`/creators`), deployed to the existing `youchop.app` Vercel project. |

## Current state (2026-07-02)

**This is a rebuild.** The original Next.js app + extension source lived in `adamtpang/youchop.app` on GitHub, which was deleted; only the Vercel deployment survived (source unrecoverable for git deploys). Check [github.com/settings/deleted_repositories](https://github.com/settings/deleted_repositories) — if the repo is still restorable, the extension source comes back with it.

- Extension: built historically, **never published** to the Chrome Web Store; source lost pending repo restore (else rebuild).
- The old deployed site's `/credits` page still says "Chaptr" (previous name) and its purchase buttons have no backend.
- Business model: **creator-revenue-first**. Presell the $99 pack with manual fulfillment starting now; the viewer extension is distribution, samples, and proof — not the business.

## Config swap-ins (search for these)

- `CHROME_STORE_URL` in `index.html` — set when the extension is published (until then the CTA degrades to an honest early-access mailto).
- `STRIPE_PACK_URL` in `creators.html` — set when the Stripe Payment Link exists (until then CTAs are mailto, which *is* the manual-fulfillment flow).

## Operating the dashboard

Open a Claude session in this repo and say: `log this week` · `check off <milestone>` · `set <metric> to N` · `add a decision`. Claude edits `vitals/vitals.data.js`; refresh `vitals/index.html`.

## Deploy

```
vercel --prod --scope adamtpangs-projects
```
The Vercel project `youchop.app` (`prj_wdbsn1IIESiWsAPGIw8JQDGf3Gz7`) already owns the domain. Note: deploying replaces the old Next.js app (including its `/credits` page).
```
<!-- END:imported-claude-context -->
