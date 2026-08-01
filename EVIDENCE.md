# EVIDENCE — youchop.app

Updated 2026-07-28 (upgrade session: self-serve chapterize).

## Activation metric (documented)

| Field | Definition |
| --- | --- |
| **Name** | **First Chapterize** |
| **What counts** | A successful `POST /api/chapterize` that returns ≥1 chapter with a paste block (engine `anthropic`, `heuristic`, or `mock`). |
| **Who** | Creator self-serve on `/chop`, Adam dogfooding own essay videos post-upload, or outreach sample generation. |
| **Activation (product)** | Browser: `localStorage.yc_activated` set on first success on `/chop`. Company metric: count of distinct successful chapterizes (and later: distinct videoIds / channels). |
| **North-star link** | First Chapterize is the top-of-funnel proof unit; **Paying Creator Channels (PCC)** remains the north star. Guardrail remains Weekly Active Choppers once the extension ships. |
| **Target (14 days)** | ≥1 First Chapterize on a real (non-mock) video with captions; ≥1 paste into a YouTube description (own channel OK for dogfood). |
| **How to measure today** | Vercel function logs / runtime logs for `/api/chapterize` 200s; manual log row below; later: single events table. |

## Baseline (as of 2026-07-28)

| Metric | Value | Source | As-of |
| --- | --- | --- | --- |
| Revenue (stranger $) | 0 | Stripe / bank | 2026-07-28 |
| MRR | 0 | Stripe | 2026-07-28 |
| Active customers (PCC) | 0 | CRM / inbox | 2026-07-28 |
| First Chapterize (all-time) | see results log | /api/chapterize proof | 2026-07-28 |
| Weekly active usage (WAC) | 0 | extension not published | 2026-07-28 |
| Time to first value | seconds (one video on /chop) | product | 2026-07-28 |
| Cost / burn attributable | ~$95/mo plan | ECONOMICS.md | 2026-07-28 |
| Top risk | Transcript provider quota / missing YT_DATA_API_KEY for channel listing; extension source lost | Ops | 2026-07-28 |

## Offer receipt

| Field | Value |
| --- | --- |
| Buyer | (none yet — free self-serve ships first) |
| Problem | Unchaptered long-form / back-catalog invisible to Key Moments |
| Cure | Transcript → paste-ready topic chapters |
| Price paid | $0 free path; $99 pack |
| Proof of value | See results log |
| Date | |

## Verified results log

| Date | Change | Before | After | Evidence link |
| --- | --- | --- | --- | --- |
| 2026-07-26 | Fleet bootstrap created this baseline | n/a | file exists | this file |
| 2026-07-28 | Live transcript probe | unknown | `POST /api/transcripts` 200 via **supadata** on `jNQXAC9IVRw` (Me at the zoo) | https://youchop.app/api/transcripts |
| 2026-07-28 | Channel search probe | unknown | **BLOCKED** `no_data_key` — `YT_DATA_API_KEY` not set on Vercel | https://youchop.app/api/channel-search?q=veritasium |
| 2026-07-28 | Shipped creator self-serve `/chop` + `/api/chapterize` | no chapter gen path | **live** on youchop.app | https://youchop.app/chop |
| 2026-07-28 | Prod E2E: `aircAruvnKk` (3Blue1Brown neural nets) | n/a | **PASS** — 8 chapters, `engine=heuristic`, `transcriptProvider=supadata`, paste starts `0:00` | `POST https://youchop.app/api/chapterize` |
| 2026-07-28 | Anthropic titles | hoped live | **BLOCKED** — Vercel `ANTHROPIC_API_KEY` returns 401 "API key is invalid"; auto falls back to heuristic | set a valid key in Vercel env |
| 2026-07-28 | Activation metric defined | TBD | **First Chapterize** = successful chapterize (≥1 chapter + paste block) | this file + NORTH_STAR.md |

## Live vs stub (cold-start audit)

| Surface | Status | Notes |
| --- | --- | --- |
| `index.html` landing | **Live** | Animated demo only; extension CTA is mailto until CWS URL set |
| `creators.html` | **Live** | Revenue surface; Stripe pack URL empty → mailto fulfillment |
| `extract.html` + `/api/transcripts` | **Live** (transcripts) | Supadata key present; mock works |
| `/api/channel-search`, `/api/channel-videos` | **Stub/blocked** | Missing `YT_DATA_API_KEY` in Vercel env |
| `/chop` + `/api/chapterize` | **Shipped this session** | Needs deploy; Anthropic key already on project for LLM engine |
| Chrome extension | **Missing** | Source lost with deleted GitHub repo; never CWS-published |
| Player render (seekbar) | **Stub** | Only CSS demo on landing; real render was extension |

## Rules

- A gate is not PASS without a number or a dated receipt.
- Self-payments and test charges do not count as stranger revenue.
- After every meaningful ship, add one row to the results log.
