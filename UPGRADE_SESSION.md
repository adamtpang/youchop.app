# UPGRADE_SESSION, youchop.app

**Date:** 2026-07-28  
**Mission:** Harden path that chapterizes Adam's own essay videos (and sells same to creators) after mp4 hits YouTube.  
**Price / offer:** $99 pack · free one-video self-serve.

---

## 1. Cold-start audit (extension vs site vs api)

| Layer | Reality | Live vs stub |
| --- | --- | --- |
| **Chrome extension** | Source lost with deleted GitHub repo; never CWS-published | **Missing**: not rebuilt (in scope: do not rebuild framework) |
| **Player render** (seekbar segments + chapter list) | Only CSS/JS demo on `index.html` | **Stub / demo** |
| **Landing** `index.html` | Static, deployed | **Live** |
| **Creators** `creators.html` | $99 pack + mailto fulfillment; Stripe URL empty | **Live** (manual fulfillment) |
| **Extract** `extract.html` | Channel → transcript tool | **Live UI**; channel search **blocked** without `YT_DATA_API_KEY` |
| **API transcripts** | Supadata / Apify / ytio chain | **Live** via **supadata** (verified) |
| **API channel-search / channel-videos** | YouTube Data API v3 | **Blocked**: `no_data_key` on prod |
| **Chapter generation** | Did not exist before this session | **Shipped** → `/api/chapterize` + `/chop` |
| **STRATEGY / GROWTH / ECONOMICS** | Present, B-first creator model | Authoritative; north star = PCC |

### Docs read

- `NORTH_STAR.md`, `EVIDENCE.md`, `STRATEGY.md`, `GROWTH.md`, `ECONOMICS.md`, `OFFER.md`, `RUNTIME.md`, `vitals/vitals.data.js`, `README.md`

### Vercel env (prod) observed

| Key | Present? | Notes |
| --- | --- | --- |
| `SUPADATA_API_KEY` | Yes | Transcripts work |
| `ANTHROPIC_API_KEY` | Yes but **invalid** (401) | Old Next.js-era secret |
| `YT_DATA_API_KEY` | **No** | Channel search/list broken |
| `APIFY_TOKEN` | No | Optional fallback |
| Stripe / Supabase keys | Yes (legacy) | Not wired to static rebuild |

---

## 2. Audit: transcript → chapter gen → player render

```
YouTube video (captions ready after upload)
        │
        ▼
 POST /api/transcripts  { ids, timestamps:true }
        │  provider: supadata (live)
        ▼
 timestamped text  [0:01] … [m:ss] …
        │
        ▼
 POST /api/chapterize  { url | id }
        │  engine auto: Anthropic → else heuristic
        ▼
 chapters[] + paste block ("0:00 Title\n…")
        │
        ▼
 /chop UI → user copies → paste into YouTube description
        │
        ✗  extension player render (source lost, out of scope)
```

**Creator value does not need the extension.** Key Moments SEO requires description paste, not seekbar chrome. Viewer extension remains distribution/demo only (STRATEGY.md).

**Post-upload dogfood (Adam essays):**  
`mp4 → YouTube processing → auto-captions → https://youchop.app/chop?url=<watch_url> → copy paste → Studio description`

---

## 3. Shipped this session

### (a) Creator self-serve one-video chapterize

- **UI:** [`https://youchop.app/chop`](https://youchop.app/chop) (`chop.html`)
- **API:** `POST /api/chapterize` (`api/chapterize.js`)
  - Body: `{ url | id | videoId, engine?: "auto"|"anthropic"|"heuristic", mock?: true }`
  - Response: `{ chapters, paste, pasteWithCredit, engine, transcriptProvider, title, author, videoId }`
- Reuses `fetchTranscripts` exported from `api/transcripts.js`
- Wired from `/creators` free-sample CTA and landing nav
- Sitemap updated

### (b) OFFER one-liner

Filled in `OFFER.md`:

> For **YouTube creators (and their editors)** who struggle with **back-catalogs and new uploads that have no searchable chapters**, **YouChop** is a **chapterization service** that **turns a video's transcript into ready-to-paste, topic-based description chapters** (and bulk-does up to 200 videos for $99). Unlike **monthly per-video tools ($19–39/mo) and generic YouTube auto-labels**, we **deliver editable Key Moments text you own forever, start free on one video at [/chop](https://youchop.app/chop)**.

### (c) Activation metric documented

| Name | **First Chapterize** |
| --- | --- |
| Definition | Successful chapterize returning ≥1 chapter + paste block |
| Surfaces | `/chop`, `POST /api/chapterize`, outreach sample gen |
| Browser signal | `localStorage.yc_activated` on first success |
| Company north star | Still **PCC**; First Chapterize is top-of-funnel proof unit |
| 14-day target | ≥1 real-video First Chapterize + ≥1 description paste (own channel OK) |

See `EVIDENCE.md`, `NORTH_STAR.md`, `vitals/vitals.data.js` (`activation` metric).

---

## 4. Explicit non-goals (honored)

- Did **not** rebuild extension framework  
- Did **not** add non-YouTube platforms  

---

## 5. Proof

### PASS, one video chapterized E2E (production)

| Field | Value |
| --- | --- |
| When | 2026-07-28 |
| Endpoint | `POST https://youchop.app/api/chapterize` |
| Video | `aircAruvnKk`, *But what is a neural network? \| Deep learning chapter 1* (3Blue1Brown) |
| HTTP | **200** |
| Transcript | `supadata` |
| Engine | `heuristic` (Anthropic auto-fallback after 401) |
| Chapters | **8** |
| Paste starts at | `0:00` (YouTube description requirement) |

Example paste (heuristic quality, usable structure, titles not yet LLM-grade):

```
0:00 This is a 3
2:33 Is a pretty cool thing for a computer to be able to do
5:08 According to the brightness of each pixel in the image
7:40 Whether or not this is what our final network.
10:14 When you compute a weighted sum like this, you might.
12:47 Down and setting all of these weights and biases by hand
15:22 Of course the specific numbers that they hold.
17:52 What this was sort of motivated from I think was a.
```

UI proof: `GET https://youchop.app/chop` → **200**, Chapterize CTA present.

Mock path also **200** with demo chapters.

### Exact blockers + fix

| Blocker | Impact | Fix |
| --- | --- | --- |
| **`ANTHROPIC_API_KEY` invalid (401)** on Vercel | Titles stay heuristic (mid-sentence fragments) | Replace with a valid Anthropic key in Vercel project env (Production + Preview). Optional: `CHAPTERIZE_MODEL=claude-3-5-haiku-latest` |
| **`YT_DATA_API_KEY` missing** | `/extract` channel search/list fails; paste-IDs still works | Add free YouTube Data API v3 key to Vercel |
| **Extension source lost** | No native seekbar for viewers | Restore deleted GitHub repo or rebuild later, **not required for creator $99 path** |
| **Stripe pack URL empty** | Pack CTA is mailto | Create Payment Link → set `STRIPE_PACK_URL` in `creators.html` |

---

## 6. Files touched

| File | Change |
| --- | --- |
| `api/chapterize.js` | **New**: chapterize pipeline |
| `api/transcripts.js` | Export `fetchTranscripts`, `parseVideoId`, `hms` |
| `chop.html` | **New**: self-serve UI |
| `creators.html` | Free sample → `/chop` |
| `index.html` | Nav + web chapterize hint |
| `OFFER.md` | One-liner filled |
| `NORTH_STAR.md` | Buyer/pain/cure + activation |
| `EVIDENCE.md` | Activation metric + live audit + proof log |
| `RUNTIME.md` | Critical paths |
| `README.md` | Current state + `/chop` |
| `.env.example` | Anthropic / chapterize notes |
| `sitemap.xml` | `/chop`, `/creators`, `/extract` |
| `vitals/vitals.data.js` | Product, roadmap, activation, decision |

---

## 7. Next actions (not done here)

1. **Set valid `ANTHROPIC_API_KEY`** on Vercel → re-hit `/api/chapterize` with `engine=anthropic` for topic-grade titles.  
2. **Set `YT_DATA_API_KEY`** so channel tools match the marketing.  
3. Dogfood: chapterize next Adam essay immediately after captions appear; paste to description; log First Chapterize in `EVIDENCE.md`.  
4. Run sample outreach using `/chop` outputs (manual pack still $99).  
5. Extension restore/rebuild only after creator path has receipts.

---

## 8. Verdict

| Gate | Result |
| --- | --- |
| Self-serve one-video | **PASS** (live) |
| OFFER one-liner | **PASS** |
| Activation metric documented | **PASS** (First Chapterize) |
| E2E proof | **PASS** (heuristic + supadata on real video) |
| LLM title quality | **BLOCKED** until Anthropic key rotated |
| Extension player | **Out of scope / missing** |

**Harden path status:** The post-upload creator path is **shipped and live**. Binding constraint moves from “no product path” to **evidence** (log First Chapterize on Adam’s own video + first stranger use) and **key hygiene** (Anthropic + YT Data API).
