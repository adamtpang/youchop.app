# EVIDENCE, youchop.app

Updated 2026-08-31 (transcript reuse cache).

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
| Buyer | YouTube creators (and editors/agencies for 5-20 channels) in tutorial/education/podcast/interview niches, ~10k-500k subs, 100+ unchaptered videos, logged 2026-08-09 from NORTH_STAR.md; no paying buyer yet, free self-serve ships first |
| Problem | Unchaptered long-form / back-catalog invisible to Key Moments |
| Cure | Transcript → paste-ready topic chapters |
| Price paid | $0 free path; $99 pack |
| Proof of value | See results log |
| Date | |

## Verified results log

| Date | Change | Before | After | Evidence link |
| --- | --- | --- | --- | --- |
| 2026-09-10 | Channel queue v0.12.0 | Channel button opened hosted extractor without queue controls | Live Latest/Popular/Oldest, duration/title filters, saved restoration, three-video YouTube playback queue, and one local Markdown transcript (22,801 chars); 30 tests | `CLAUDE.md`; Helium recording `youchop-channel-queue-v0120` |
| 2026-09-06 | Extension stalled-loader retry fix v0.11.1 | v0.11.0 log repeated a failed native loader; throttled timer loop reached 244s | 26/26 tests; live local extraction 574 rows / 22,007 characters in 7.7s; cache 17ms; visible Chop panel showed full output | `CLAUDE.md`; Helium recording `youchop-transcript-v0111` |
| 2026-07-26 | Fleet bootstrap created this baseline | n/a | file exists | this file |
| 2026-07-28 | Live transcript probe | unknown | `POST /api/transcripts` 200 via **supadata** on `jNQXAC9IVRw` (Me at the zoo) | https://youchop.app/api/transcripts |
| 2026-07-28 | Channel search probe | unknown | **BLOCKED** `no_data_key`, `YT_DATA_API_KEY` not set on Vercel | https://youchop.app/api/channel-search?q=veritasium |
| 2026-07-28 | Shipped creator self-serve `/chop` + `/api/chapterize` | no chapter gen path | **live** on youchop.app | https://youchop.app/chop |
| 2026-07-28 | Prod E2E: `aircAruvnKk` (3Blue1Brown neural nets) | n/a | **PASS**: 8 chapters, `engine=heuristic`, `transcriptProvider=supadata`, paste starts `0:00` | `POST https://youchop.app/api/chapterize` |
| 2026-07-28 | Anthropic titles | hoped live | **BLOCKED**: Vercel `ANTHROPIC_API_KEY` returns 401 "API key is invalid"; auto falls back to heuristic | set a valid key in Vercel env |
| 2026-08-30 | Playlist transcript presentation | all video transcripts concatenated into one document | **PASS**: extension v0.10.4 exposed 3/3 private-playlist videos as separate selectable Markdown files; switching files changed the isolated transcript and metadata | `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-playlist-separate-markdowns-v0104-live` |
| 2026-08-31 | Transcript reuse cache | repeat formats and browser chops could re-run extraction | **PASS in tests, not deployed**: 22/22 tests; clean then timestamped requests made one provider call total; extension cache hit returned before the extraction path could open | `npm test`; `api/transcripts.test.cjs`; `extension/lib.test.cjs` |
| 2026-08-31 | Extension cache browser canary | v0.11.0 load was unverified | **PARTIAL**: Helium showed v0.11.0 and opened Chop on `Z9iksIAXcbk`; YouTube removed the injected panel during transcript loading, so second-click reuse was not proven live | `C:\Users\adamp\.config\browser-harness\agent-workspace\recordings\youchop-transcript-cache-v0110-paused-target` |
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
