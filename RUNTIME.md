# RUNTIME — youchop.app

Generated 2026-07-26 by Summon fleet standardizer.

## Local run

Open `index.html` or serve the static root. API routes need `vercel dev` (or production) plus env from `.env.example`.

## Deploy

```
vercel --prod --scope adamtpangs-projects
```

## Critical paths

| Path | Needs env | Notes |
| --- | --- | --- |
| `POST /api/transcripts` | `SUPADATA_API_KEY` and/or `APIFY_TOKEN` | Live on prod (supadata) |
| `POST /api/chapterize` | transcripts + optional `ANTHROPIC_API_KEY` | Heuristic works without Anthropic |
| `GET /api/channel-search` | `YT_DATA_API_KEY` | **Missing on prod as of 2026-07-28** |
| `/chop` | chapterize | Creator self-serve UI |

## Agent execution adapters (Summon lanes)

| Lane | When to use | Notes |
| --- | --- | --- |
| Claude Code | Default deep work while quota remains | Resets weekly; hand off via sync |
| Codex | When Claude is exhausted | Keep `AGENTS.md` / `CODEX_CONTINUE_FROM_CLAUDE.md` current |
| Grok | When Claude and Codex are exhausted | `node .grok/sync-to-grok.js` then read `GROK_CONTINUE_FROM_*.md` |

Strong default model: whatever the active adapter's best coding model is.  
Low-reasoning lane: short, bounded tasks (lint, rename, one-file edits) on a fast model when available.

## Health proof

After each ship, record in `EVIDENCE.md`: URL or command, status code / screenshot, date.
