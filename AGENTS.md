## October 21, 2026: Public transcript entry and web readiness

Homepage now leads to `/extract` with a prominent Get a YouTube transcript button. No extension installation or email is required; the unpublished extension is labeled as a preview. Removed unsupported credit/referral claims and stale image metadata. Navigation distinguishes transcripts from chapters. Mobile navigation, inputs, history cards and decorative glows fit 390px without horizontal overflow.

Caption entities are decoded at the API presentation boundary, including cached results. Transcript HTML/error/history rendering escapes external text. Requests have a 65-second client deadline; a 429 stops the batch without automatic retry, and unavailable timestamps preserve clean output with an explanation. Chapter output is editable and copying respects edits; basic fallback drafts have an explicit warning. 37 Node tests pass. Isolated Helium fixtures cover error recovery, literal markup, missing timestamps and edited chapter copying; live landing-to-transcript, timestamps, clipboard and Markdown download passed with jNQXAC9IVRw. Private evidence: exports/web-readiness-2026-10-21/.

Production AI chapter generation is still blocked by Anthropic HTTP 401, invalid x-api-key. A synthetic canary returned three labeled heuristic chapters; this does not verify AI chapter quality. A valid production Anthropic credential is required. Do not claim the whole product is perfect. The extension remains unpublished and the personal Helium extension was not reloaded.

Pending corpus work: Yusufa Sey channel for Anchor. Adam selected **United States nationwide** for accountancy-firm leads. See exports/yusufa-sey-2026-10-19/PENDING.md; requested video's local transcription completed, but full corpus reconciliation and Anchor copy/prompt are still pending.

<!-- BEGIN:imported-codex-context -->
## October 19, 2026: Deep transcribe modal fallback v0.14.0

Single-video Chop defaults to timestamps when available; untimed results stay clean with timestamp formats disabled. Modal Deep transcribe highlights absent/untimed/possibly incomplete captions and remains available manually. Background bridge validates the sender/video, uses only loopback 8876 with bounded requests and a server session token. Protocol 2 detects stale services. Local server now accepts strict individual YouTube URLs, deduplicates/reconnects queued/running/completed URL/model jobs, and runs Whisper small in bounded 180-second audio windows. Progress/result/error stays in modal; closing leaves local work running. Successful results enter browser cache. Download limits, no cookies/paid speech API, machine-accuracy and chunk-boundary limitations documented. 35 Node and 7 Python tests; isolated Helium fixture UI verified recovery/offline/390px layout; real local 85.397-second audio smoke produced 305 words/18 segments, last speech at82.6s. Evidence exports/deep-transcribe-2026-10-19/. Installed-extension end-to-end bridge/download not live-verified; everyday Helium extension not reloaded. No site deploy.


# CLAUDE.md - youchop.app

## October 19, 2026: Summon corpus copy and SenraJobs Sage embed handoff

Adam requested both refreshed Founders/Senra corpora inside summon.guide and a prompt to implement embeddable Sage for senrajobs.com. Copied both snapshots to summon.guide/content/knowledge/_transcripts/youchop-sync-2026-10-19/ (founders-podcast and david-senra subfolders), verified 205+74 content-file hashes and both checksum manifests. Existing Git/Vercel exclusions cover this private path. HANDOFF.md and COPY-RECEIPT.json are saved there. Implementation prompt delivered to existing Summon chat 01a076b2-d97e-71f2-b534-3280bf3b87ad: ingest/register, synthesize 13 additions, verify retrieval, build embed contract/component and local SenraJobs example while preserving its existing local Claude/Codex runtime. No claim that copying alone updates live Sage; no deployment or direct SenraJobs-chat message performed.

## October 19, 2026: Founders and David Senra episode sync

Private snapshots: exports/founders-podcast-2026-10-19/ and exports/david-senra-2026-10-19/. Founders now has 175 episode documents: 170 exact-ID cached copies plus five Podscripts podcast-edition transcripts (#433-437, 53,393 new words), 2,179,996 total words. New editions match official publisher numbers/titles/dates but are not audio-verified identical to YouTube edits; archive times stay podcast-only. Latest #437 The Tycoons is October 13. Senra has all 48 full interviews: 40 cached plus six official publisher transcripts and two exact-video PodHood recoveries (Alexandr Wang/Ari Emanuel, official sections empty), 127,808 new words, 932,551 total. Latest Kurt MacAlpine is October 18; 81-second trailer qK1Yvt24WYg remains missing. Founders 73 Shorts and Senra 112 Shorts catalogued but not transcribed. No Streams collection returned. Original Summon collections unchanged; old curated indices undercounted their actual cached pages. All 210 reused-document hashes verified against originals; 205 Founders and 74 Senra artifact files hashed. Audio accuracy remains unverified. Earlier caption HTTP 429 respected without new caption requests; no paid provider, deployment, publication or cross-project handoff.

## October 19, 2026: Brett Cenkus corpus and Anchor handoff

Public channel UC05tHaU8MZuxsFjPWpWnqiA catalogued: 146 Videos and 48 Shorts, 194 unique IDs; no Streams collection returned. First caption request tJIY_S7Zhwg hit HTTP 429 and stopped. Recovered 16 regular-video texts (26,049 words): 13 publisher video-text pages from Cenkus Law through isolated Helium and three Zolidar Grid caption archives, all matched by exact video ID. Missing: 130 Videos and all 48 Shorts. Publisher text may be edited; timestamps, audio accuracy and ending completeness are unverified. Private snapshot exports/brett-cenkus-2026-10-19 includes full index, topic index, corpus, raw sources, manifest, quality report and 51-file checksums. Hash-verified copy in the active Anchor checkout C:/Users/adamp/.codex/worktrees/b9cd/anchormarianas.com/.anchor/acquisition-reference/brett-cenkus-2026-10-19/, Git-excluded and explicitly Vercel-excluded. User-authorized learning prompt delivered to existing anchor.com chat 01a0713b-ee16-7de0-b615-d41d459eebd8. No paid provider, immediate caption retry, public publication or deployment.

## October 18, 2026: Chop button visibility v0.13.1

Main Chop transcript action stays visible regardless of chapters. Its injector now selects a rendered action row, relocates out of hidden/replaced rows, and falls back to a floating button for Shorts, embeds, fullscreen or missing action rows. Live video URLs recognized; open panels follow fullscreen transitions. Existing Make chapters duplicate-generation handling remains separate.32 existing tests passed; syntax and watch/Shorts/live/embed URL checks passed. Isolated Helium DOM verification on chaptered miTYqqZnrXE showed one visible button, verified hidden-row floating fallback and restoration without duplicates. Evidence: exports/chop-visibility-2026-10-18/proof.json. Saved extension files updated; Adam's everyday Helium extension was not reloaded. No site deploy.


## October 18, 2026: Base Power knowledge export for SenraJobs

Private export: `exports/base-power-2026-10-18/`. Official help-center links corroborate @BasePowerCompany, channel UCtfzwy6WPbKQEK7_uTMCtEA. Live catalog: 37 Videos +25 Shorts; explicit Streams check reports no tab. Available: all37 Videos +16 Shorts, plus one preserved accessible unlisted ComEd upload;54 timed transcripts/18,711 words. Reused34 raw caption files, fetched20; four Shorts unavailable to extractor and HTTP429 stopped the final five caption requests.63 per-item notes include nine metadata-only gap records. README, INDEX, TOPIC-INDEX, NOTES, CURRENT-FACTS, INTERVIEW-PREP, CSV/JSON manifest, raw sources and hashes saved privately. Both exact Member Experience Associate and SDR jobs listed on the check date. Historical/current product claims separated. Old B6OBRmO2pww page conflicts with fresh exact-ID captions; preserved but excluded from current corpus.279 export files hashed; paths, counts,34 copied-source hashes and timestamp ranges verified. No paid API, deployment, publication, applications or outbound handoff message.


## October 12, 2026: Instagram transcription and Koerner AI evidence

Added free local Instagram/video-file transcription: tools/local_transcribe.py, loopback UI/server, npm run transcribe (127.0.0.1:8876), and extension v0.13.0 popup handoff. Uses local yt-dlp + faster-whisper CPU int8; no paid speech API, cookie export or audio upload. The supplied Forbes Reel DeKieZFiL7e downloaded anonymously and passed CLI/Helium UI extraction: 306 words, 85 seconds. File-upload path passed too. Model small cached; missing models download once. 32 Node tests and 4 Python tests pass, mobile UI 390px has no horizontal overflow. Actual saved extension reload was not performed; the independent local UI is running. Setup/limitations: INSTAGRAM-TRANSCRIPTS.md. Source/output and screenshots stay under ignored exports/.

Koerner Office root catalog refreshed: 454 Videos, 18 Live, 511 Shorts. Three YouTube captions (16,685 words) recovered before HTTP 429; two attempted entries require membership. Public podcast index has 380 episodes; 59 AI-title candidates, 11 recovered (96,089 words) before archive HTTP 429. Private collection exports/koerner-2026-10-12/ distinguishes editions and is not a complete-channel corpus. AI-BUSINESS-EVIDENCE-2026-10-12.md under exports/ reviews targeted Koerner, Starter Story and Greg Isenberg cases with sources and self-reported-earnings limitations. No immediate rate-limit retry, paid provider, deployment, publication, outreach or cross-project handoff.

## October 6, 2026: Naval channel reconciliation

Official channel @NavalR now lists 175 Videos and 93 Shorts, 268 unique uploads; no Streams collection returned. Previous summon.company/knowledge/naval corpus had 159 transcripts from the 175-video catalog and excluded Shorts. New private snapshot exports/naval-2026-10-06/ reuses those 159 by ID and recovers the remaining 16 regular-video texts from official nav.al posts verified by exact YouTube links. All 175 regular uploads have documents, 371,941 words total; 93 Shorts remain missing. Original corpus preserved. Combined corpus, source-linked index, caption timing where available, raw sources and hashes verified. Official publisher text may be edited; audio accuracy and ending completeness remain unverified. Recent YouTube HTTP 429 prevented caption retrieval for Shorts; no immediate retry, paid provider, deployment, publication or project handoff. Git/Vercel exclude exports/.

## October 6, 2026: Dalton + Michael channel

Whole public channel catalog contains 37 Videos and 27 Shorts (64 unique IDs; no Streams tab returned). Direct caption retrieval hit HTTP 429 on the first video (7TU636F_yVQ) and stopped. Recovered 26/37 regular-video transcripts, 85,538 words, from public Celaeno pages matched by exact YouTube source ID. No Shorts recovered: 38 total gaps. Private output: exports/dalton-michael-2026-10-06/, including corpus.md, INDEX.md, README.md, QUALITY.md, per-video documents, original HTML/catalog and manifest hashes. Text accuracy and ending completeness not checked against audio; no timestamps invented. Archive text is not represented as YouTube-original captions. Git and Vercel exclude exports/. No paid provider, immediate 429 retry, deployment, publication or project handoff.

## September 22, 2026: Tim Ferriss / Kevin Rose Random Show

Private corpus at `C:/Users/adamp/.local/share/youchop/corpora/random-show/2026-09-22/`: 28 numbered podcast episodes, 537,993 words. Reused 25 official blog transcripts from summon.guide's August 24 archive and fetched official PDFs for episodes 24, 46 and 146 (109 pages total). Live official post/transcript sitemaps checked for additional matching URLs; latest included is episode 875 (July 16, 2026). Combined corpus, episode index, 28 individual documents, manifest with verified SHA-256 hashes, raw sources, quality notes and rebuild script saved privately. Earlier unnumbered/video editions catalogued separately, not counted as podcast transcript coverage. No Unicode replacement characters found; audio accuracy remains unverified. No paid provider, deployment or cross-project handoff. Old ObsidianVault/Notes/Library path was absent at extraction time, so this corpus uses the private local-share path above.

## September 13, 2026: Greg Isenberg, Jim Fung and EO corpora

Extracted three public Videos-tab channels, all durations, with `tools/corpus-reconcile.mjs` (local yt-dlp, no hosted provider): first pass on September 11, one retry pass on September 13 for transient read timeouts, no HTTP 429 in either. Private snapshots: `C:/Users/adamp/ObsidianVault/Notes/Library/<Name>/sync-2026-09-11-retry/` is canonical for each; the first-pass `sync-2026-09-11/` directories hold cached files referenced by absolute path and must be kept. Each canonical directory has `corpus.md`, `INDEX.md`, `QUALITY.md`, `README.md` (coverage, gaps, resume command), manifest, per-video `<id>.md` and `<id>.timed.md`, and raw captions in `_subs/`.

- @GregIsenberg: 446 listed, 445 transcripts, 3,414,581 words. 367 reused by video ID from `summon.company/knowledge/greg-isenberg` (July 22 corpus, left untouched). One gap, `xLa-9_gi7Wg` (no English captions). One possible early ending, `x_icl0CzOfA` (captions end 55 seconds before its 54:50 listing).
- @jimmyfung_: 155 listed (one uploaded after September 11), 155 transcripts, 954,130 words, no gaps.
- @eoglobal: 282 listed, 282 transcripts, 842,503 words, no gaps. 19 possible early endings (captions end 31 to 41 seconds before the listed duration; EO videos carry music and end cards, so most are likely outros, but they were not checked against the audio). `summon.company/knowledge/eo/` is an empty earlier attempt and was not used.

Verified per snapshot: every manifest path resolves, per-video file counts and corpus sections equal availability, no stray files. Caption accuracy is not independently verified. Em dashes inside the Greg and EO corpora are verbatim YouTube titles (`153EkQiLmf0` and 3 EO titles), kept as source data. No deployment, publication, paid fallback, immediate 429 retry, or cross-project handoff.

Tool note: `tools/corpus.mjs` passes `--ignore-errors` to yt-dlp, so under rate limiting it records a 429 as "no captions". Prefer the reconciler when YouTube has been throttling; it stops on the first access error and records it.


## September 13, 2026: @visakanv corpus

Extracted public Videos-tab uploads, all durations, with local yt-dlp: 460 listed, 429 transcripts, 1,212,515 words. Twenty videos had no usable English captions; HTTP 429 on `oRYtFYZT_qc` stopped retrieval, leaving ten unattempted (31 total gaps). Private output: `C:/Users/adamp/ObsidianVault/Notes/Library/Visakanv/sync-2026-09-13/`, with combined corpus, index, 429 timestamped documents, raw captions, manifest and quality report. All 429 paths verified; no possible early endings under the 30-second threshold, but transcription accuracy is unverified. Private README records cooldown/resume guidance. No paid fallback, immediate retry, deployment, publication or cross-project handoff.

## September 12, 2026: research handoffs

Adam explicitly requested a GDC knowledge-base copy inside Eyeland and a learning prompt. Copied 1,783 timed documents plus combined corpus, index and quality/provenance to `eyeland.cards/knowledge-private/gdc/`; 1,786 copied content files hash-verified and the destination manifest uses relative transcript paths. Git and Vercel exclude `knowledge-private/`. `HANDOFF_GDC_FROM_YOUCHOP.md` contains the durable prompt; sent it to the existing Eyeland task `01a07a68-c70e-7dc3-ad79-36883192f4cd`. The original vault corpus is preserved.

Sensible Transfers extraction complete: 136/137 selected videos, 530,777 words, across Tifo Football, The Athletic FC and The Athletic FC Podcast public Videos tabs. Missing captions: `E3CZvflW0mw`; possible early ending: `oUHmzg2G8JI`; no rate-limit stop. Private library: `ObsidianVault/Notes/Library/SensibleTransfers/sync-2026-09-12/` under Adam's home. Verified local copy in `darktalent.tech/knowledge-private/sensible-transfers/`, excluded from Git/Vercel, with 139 copied content files hash-verified and portable manifest paths. DarkTalent's `SENSIBLE-HIRES.md` and `HANDOFF_SENSIBLE_TRANSFERS.md` preserve Adam's company-diagnosis → tech-talent-market → sensible-hires series/agency concept and existing ECOSYSTEM.md roles. Eyeland completed its GDC research pass in `game/GDC-LESSONS.md`; playtests remain proposals.

## September 11, 2026: GDC corpus

Official channel now uses `@GDCFestivalofGaming` (channel ID `UC0JB7TSe49lg56u6qH8y_MQ`; old `@Gdconf` returns 404). Private library: `C:/Users/adamp/ObsidianVault/Notes/Library/GDC/merged-2026-09-11/`. Live public Videos-tab catalog: 1,916 videos, all durations. Available: 1,783 transcripts / 13,066,052 words, comprising 1,738 ID-matched community Whisper transcripts from `dklassic/GDC-transcript` commit `aa864490ba81ae02da84fe769042ea938e3a73a1` and 45 locally fetched YouTube English captions. Archive provenance recorded privately; explicit disallowance entries excluded. YouTube HTTP 429 on `jbZ3ntEvs4Y` stopped further retrieval: 5 no-captions, 1 blocked, 127 unattempted gaps. No immediate retry or paid fallback. Combined `corpus.md` is ~81 MB; `INDEX.md` links all individual timestamped documents and missing videos. All paths verified; 68 possible early endings flagged, accuracy not independently checked. Resume instructions and archive sources are in private `GDC/README.md`; reuse the latest manifest into a new snapshot after cooldown. No deployment, publication, or Eyeland handoff for GDC.

## September 11, 2026: @adomakins corpus

Extracted Adam Skjervold's public Videos-tab uploads, all durations, via local yt-dlp: 257 listed, 255 English-caption transcripts, 541,894 words. No rate-limit stop. Missing English captions: `lSCOl3WMNuw` (Playing pickleball), `XMhNSxHTwXI` (Lightweight Flywheel Install and Review (FULL)). Private output: `C:/Users/adamp/ObsidianVault/Notes/Library/Adomakins/sync-2026-09-11/` containing `corpus.md`, `INDEX.md`, manifest, quality report and 255 per-video `*.timed.md` documents. All manifest paths verified; no caption end more than 30 seconds before listed duration. Caption accuracy is not independently verified. No hosted provider, deployment, publication or cross-project handoff requested or performed.

## September 11, 2026: Elan Lee corpus for eyeland.cards

Extracted @ElanLee public Videos-tab uploads with the local reconciler: 25 listed, 23 transcripts, two without English captions, no access-error stop. Private corpus lives in `C:/Users/adamp/ObsidianVault/Notes/Library/ElanLee/sync-2026-09-11/` with combined `corpus.md`, per-video timestamped Markdown, manifest/index, and quality report. 69,307 words; no caption end more than 30 seconds before the listed duration. Raw material stays outside public repos. `eyeland.cards/HANDOFF_FROM_YOUCHOP.md` supplies a concrete source-linked game-design learning task for the existing Eyeland task. No paid provider or deployment.

## September 10, 2026: Channel queue builder v0.12.0

- Channel-page **Build channel queue** replaces the old handoff to hosted `/extract`. Popup supports channels too. Latest / Most popular / Oldest, count 1–50, min/max minutes, and title-contains filters produce an editable preview. Filters apply before the requested count, preserving native YouTube order.
- `extension/channel-queue.js` reads public Videos-tab metadata in MAIN, uses YouTube’s actual sort continuation token, and paginates. It skips the separate sort-header reload action when selecting feed items. The injected function is a serializable function expression, with explicit error results across the extension boundary.
- Latest queue is saved under `youchop.channelQueue.v1` in local extension storage. Preview supports Remove, Watch queue (temporary YouTube `watch_videos` playlist), Download links, and Chop transcripts via the existing local playlist extractor. It does not save playlists to the YouTube account. Scan limit 2,000 videos / 70 pages is labeled if reached. Duration filters exclude unknown durations; missing matches are reported honestly.
- Live Helium: latest first `OV09yPLf8BI`, popular first `8xgnm6SynH4`, oldest first title “How To Make $30K/month With Cooking”. Duration filter returned 21:49 and 23:36 videos; title filter returned three SaaS videos. Reopening restored the filter and queue. Watch generated a temporary playlist with the exact three IDs in order. Removing two and chopping the remaining `BA_fC95p43c` produced one Markdown document, 22,801 characters, local/free.
- `npm test`: 30 tests, including filter-before-limit, ID deduplication, native sort pagination with separate header updates, serialization, and reader error propagation. v0.12.0 loaded from the saved extension path. No site deploy or hosted provider used.
- Recording: `C:\Users\adamp\.config\browser-harness\agent-workspace\recordings\youchop-channel-queue-v0120`.
- Final pagination check built 50/50 Latest videos across multiple pages; builder left open on Starter Story. Final extension inspection: v0.12.0, zero runtime and manifest errors.

## September 10, 2026: Productize skill test

- Added `PRODUCTIZE.md`: bounded creator chapter-pack offer, evidence audit, labor sensitivity, and a proposed external sample test. No commercial terms or runtime behavior changed.
- Found $99 in OFFER.md versus $49 in creators.html; source already contains a Stripe pack link, contrary to older STATUS.md. Checkout amount and current customer revenue remain unverified.
- Existing-chapter guard limits the offer to unchaptered videos. `npm test` passed 26/26; this establishes local behavior, not demand. External use is the binding evidence gap.
- Reusable skill: `C:/Users/adamp/.codex/skills/productize/SKILL.md`. Next: resolve price conflict and obtain an owned/permitted sample input. Preserve other ongoing extension/corpus work.

## September 6, 2026: Extension stalled-loader retry fix

- Pasted failure log #9 (v0.11.0, `Z9iksIAXcbk`) showed the failed native loader running twice; 50 timer ticks took 244 seconds in the second attempt. Zero-size transcript panels alone are not proof of failure: the same layout succeeded in today's baseline and verification.
- v0.11.1 retains a priming failure for the current extraction, so the fallback does not repeat it. Native and panel waits now use elapsed-time deadlines. A 12-second worker response watchdog bounds the MAIN-world request independently of page timer throttling; a late reply is ignored. This is not an overall extraction deadline, and a suspended page still needs to resume to process results.
- Transcript chip selection now uses the nested button and honors its selected state.
- `npm test`: 26/26 pass, including duplicate-failure prevention, selected chip behavior, worker timeout/late completion, and a simulated minute-long background timer delay.
- Reloaded saved unpacked extension in Helium as v0.11.1, zero manifest/runtime errors at reload. Fresh local extraction on `Z9iksIAXcbk`: 574 unique lines, 22,007 characters, final timestamp 921s of 923s, 7.7 seconds. Second extraction: browser-cache, 17ms. Clicking the actual Chop button displayed all 22,007 characters with the saved-transcript label.
- Historical HTTP 400/402 failure did not reproduce today; timeout failure behavior is covered by tests, not claimed as a reproduced live outage. No hosted provider, deployment, publishing, download, or clipboard action used.
- Recording: `C:\Users\adamp\.config\browser-harness\agent-workspace\recordings\youchop-transcript-v0111`.

## September 6, 2026: Starter Story coverage audit

Latest pickup sync: **179/181** available, two missing (`NFWV9wxRuv4`, `hCvy-Rt7Naw`). Three additional transcripts recovered; HTTP 429 stopped retrieval again. `--reuse MANIFEST` now carries forward prior snapshots; future syncs request one English track to avoid duplicates (not yet live-verified). Four focused tests pass. Latest private snapshot: `ObsidianVault/Notes/Library/StarterStory/sync-2026-09-06-2010` under Adam's home. See `STARTER-STORY-SYNC.md` before resuming; preserve the rate-limit cooldown.

Added non-destructive `tools/corpus-reconcile.mjs` and three passing focused tests. All-duration public upload coverage is 176/181 after one local caption recovery, not the 16 entries in the old 20-minute-filtered manifest. Five are missing and YouTube HTTP 429 stopped further retrieval. Original corpus preserved, private snapshot and analysis stay outside this public repository. No hosted quota, deployment or recurring automation used. See `STARTER-STORY-SYNC.md` for scope and continuation.

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

**Real chapters for every YouTube video.** A Chrome extension that reads a video's transcript and renders AI-generated, clickable chapters in YouTube's own player UI (seekbar segments + chapter list), plus a creator service that chapterizes entire back-catalogs.

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

**This is a rebuild.** The original Next.js app + extension source lived in `adamtpang/youchop.app` on GitHub, which was deleted; only the Vercel deployment survived (source unrecoverable for git deploys). Check [github.com/settings/deleted_repositories](https://github.com/settings/deleted_repositories), if the repo is still restorable, the extension source comes back with it.

- Extension: built historically, **never published** to the Chrome Web Store; source lost pending repo restore (else rebuild).
- The old deployed site's `/credits` page still says "Chaptr" (previous name) and its purchase buttons have no backend.
- Business model: **creator-revenue-first**. Presell the $99 pack with manual fulfillment starting now; the viewer extension is distribution, samples, and proof, not the business.

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
```

## Extension native continuation fix and trace (2026-08-30)

- Helium loads the unpacked extension from
  `C:\Users\adamp\Aether\youchop.app\extension`. It was still v0.8.9 while the
  first transcript-spinner fix existed only in a Codex worktree. The validated
  extension files are now synchronized to this saved project.
- v0.9.1 added a chronological, privacy-safe failure trace with runtime versions,
  panel waits and chip selection, response statuses and byte counts, parser counts,
  and a final DOM snapshot. It never includes cookies, API keys, visitor data,
  continuation values, response bodies, or transcript text.
- The live trace showed that a reconstructed `/youtubei/v1/get_transcript` POST
  receives HTTP 400 `FAILED_PRECONDITION`, even with the command's click-tracking
  context. Calling YouTube's continuation element `triggerContinuation()` instead
  returned HTTP 200 and rendered 326 transcript rows on `Xc0ERidGLJc`.
- v0.9.2 now uses YouTube's native continuation method first and retains the
  reconstructed request only as a compatibility fallback. Live Helium verification
  passed from this saved extension path with no manifest or runtime errors:
  `Xc0ERidGLJc` completed in about 3 seconds, rendered 326 YouTube rows, harvested
  323 unique lines, and produced 12,038 characters through the local free path.

## Extension local chapter and playlist path (2026-08-30)

- v0.10.0 sends the already-extracted timestamp rows to `/api/chapterize`.
  The endpoint labels the source `browser-local` and skips TranscriptAPI,
  Supadata, and Apify instead of refetching the same transcript.
- Chapter output is shown in an editable field with a `https://youchop.app` watermark and is
  copied only after a second explicit click. YouChop never posts to YouTube and
  grants no credit or other reward for copying, pasting, or commenting.
- Public playlist pages and watch URLs with `list=` now expose **Chop playlist**.
  The extension lists videos through `/api/playlist-videos`, processes up to 50
  videos sequentially in temporary inactive YouTube tabs, closes only its own
  tabs, and emits a linked Markdown corpus with per-video failures.
- Playlist transcript extraction is local-only. It does not fall back to hosted
  transcript providers, so exhausted provider credits cannot consume a playlist
  run. Chapter generation still sends transcript text to youchop.app and may use
  Anthropic, as documented in `extension/README.md`.
- Verification command: `node --test extension/lib.test.cjs api/chapterize.test.cjs`.
  The suite currently has 18 passing tests covering local-row chapterization,
  playlist URL detection/rendering/message dispatch, and prior transcript fixes.
- Live Helium verification found and fixed YouTube's current playlist-header host
  (`.metadata-buttons-wrapper`). The saved extension reloaded as v0.10.0, showed
  **Chop playlist** on Ben Cera's 35-video uploads playlist, and advanced through
  local temporary-tab extraction. A cancellation check also exposed tabs that
  could remain alive long enough to autoplay. Jobs now track tab ids, pause and
  mute media, cancel explicitly when the panel closes, and retry tab cleanup.
  The repeat run left zero new YouTube watch tabs after cancellation.

## Duplicate guard, full-video chapters, and production deploy (2026-08-30)

- Extension v0.10.1 and `/api/chapterize` now refuse duplicate work when YouTube
  already exposes creator or automatic chapters. Detection covers macro-marker
  panels and valid description timestamp sequences. The API returns HTTP 409
  `already_chapterized` before using transcript-provider or model quota.
- Extension v0.10.2 hides the chapterize button entirely when the live YouTube
  page already exposes macro markers or a valid timestamp sequence in its
  description. The server-side HTTP 409 remains the stale-client backstop.
  Live Helium verification on `Z9iksIAXcbk` found one macro-marker panel,
  extracted 22,007 characters locally, and confirmed the chapterize button's
  computed and inline display were both `none`.
- The explicit 20-chapter ceiling was removed from the heuristic, Anthropic
  prompt, and model-output parser. A deterministic coverage pass fills oversized
  gaps if model output ends early, and an incomplete local transcript returns HTTP
  422 instead of producing a partial chapter list.
- Attributed output now ends with `⏱ Chapters by https://youchop.app`.
- Production deploy: Vercel deployment `dpl_AG8ceqJ2gnJVnRouRL2AAVgYYGPw`,
  aliased to `https://youchop.app`. Inspector:
  `https://vercel.com/adamtpangs-projects/youchop.app/AG8ceqJ2gnJVnRouRL2AAVgYYGPw`.
- Live API canaries passed: a 65-minute synthetic local transcript returned 26
  chapters through `browser-local`, reached its final row, and included the URL
  watermark. `Z9iksIAXcbk` returned HTTP 409 because YouTube already exposes
  chapters for it. The rendered `/chop` page showed the same duplicate warning.
- The production file allowlist remains controlled by `.vercelignore`; local
  exports, agent state, Markdown handoffs, tests, and extension source are not
  published by the site deploy.
- Helium reloaded the unpacked extension from
  `C:\Users\adamp\Aether\youchop.app\extension` and confirmed version 0.10.3 with
  no extension errors. It remains unpublished to the Chrome Web Store.
- Browser evidence:
  `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-prod-deploy-20260830-v0101`
  and
  `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-prod-duplicate-guard-20260830-retry`.

## Deploy configuration

- Platform: Vercel
- Project: `youchop.app` (`prj_wdbsn1IIESiWsAPGIw8JQDGf3Gz7`)
- Production URL: `https://youchop.app`
- Command: `vercel deploy --prod --scope adamtpangs-projects --yes --logs --no-color`

## Per-video playlist Markdown files (2026-08-30)

- Extension v0.10.4 no longer presents a chopped playlist as one concatenated
  transcript. The extraction job is unchanged, but the result panel now has a
  transcript-file picker with one standalone document per successfully chopped
  video.
- Each Markdown document has its own `.md` filename, YAML frontmatter, source and
  timestamp deep links, playlist title, playlist URL, and playlist position.
  Copy and Download operate only on the selected file.
- Verification command: `node --test extension/lib.test.cjs api/chapterize.test.cjs`.
  The suite passes 19/19 tests, including isolation between two playlist documents.
- Live Helium verification reloaded the unpacked extension as v0.10.4 and chopped
  all 3 videos in private playlist `PLN0KY-6tdXjA`. The picker showed 3 distinct
  `.md` filenames; switching from file 1 to file 2 changed the title, video id,
  source link, playlist position, and transcript. No file was downloaded or copied.
  Evidence:
  `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-playlist-separate-markdowns-v0104-live`.

## Private playlist listing and visible button fix (2026-08-30)

- Exact reproduction: Adam's open playlist `PLN0KY-6tdXjA` is private and has
  three videos. The anonymous production endpoint returned HTTP 502 because
  YouTube told Vercel the playlist did not exist, while the signed-in Helium page
  rendered all three `ytd-playlist-video-renderer` rows.
- Extension v0.10.3 now reads rendered playlist rows locally before calling the
  public endpoint. This supports private and unlisted playlists available to the
  signed-in user without sending cookies or YouTube credentials to YouChop.
- YouTube currently keeps an obsolete zero-sized playlist header beside its
  visible header. The old injector selected the first action model, so the button
  existed at 0x0 pixels. Injection now selects a rendered host by geometry and
  relocates a stale hidden button when the visible header appears.
- Content scripts now expose a versioned cleanup hook. Future extension updates
  can replace their observer, timer, and runtime listener safely; older playlist
  tabs receive one reload during the v0.10.3 upgrade.
- Live Helium verification confirmed a visible 304x36 `Chop playlist` button,
  local listing advanced immediately to `chopping video 1 of 3`, cancellation
  removed the panel, and zero temporary watch tabs remained. Evidence:
  `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-private-playlist-fix-v0103`.

## Transcript reuse cache (2026-08-31)

- Extension v0.11.0 stores successful transcript segments in
  `chrome.storage.local` by video id and language. Entries expire after 90 days
  and are bounded to 80 transcripts and roughly 7 MB. Single-video extraction
  checks this cache before opening YouTube's transcript UI; playlist extraction
  checks it before creating a temporary watch tab.
- `api/transcripts.js` now stores successful provider-fetched public transcripts
  in Vercel Runtime Cache for 30 days. Timestamped rows are canonical, so clean
  and timestamped requests share one provider result. Cache failures fail open;
  transcript failures are never cached.
- Browser-local rows are intentionally not written to the shared server cache.
  This keeps private and signed-in playlist transcript text on the user's device.
- `npm test` passes 22/22 tests. The cache regression proves a clean request and
  a later timestamped request make one provider call total, and the extension
  regression proves a cache hit returns before any extraction path can open.
- Helium loaded the unpacked extension as v0.11.0 on `Z9iksIAXcbk` and opened
  the extraction panel. YouTube removed the injected panel while opening its
  transcript UI in the automated run, so this session does not claim a completed
  second-click browser proof. Recording:
  `C:\Users\adamp\.config\browser-harness\agent-workspace\recordings\youchop-transcript-cache-v0110-paused-target`.
- This cache revision has not been deployed. The shared Vercel Runtime Cache path
  does not affect production until Adam explicitly authorizes a production deploy.

## Visa handoff to summon.guide (2026-09-13)

At Adam's request, copied the 429-transcript Visa corpus into summon.guide/content/knowledge/visakan/_raw/youtube-2026-09-13/. Verified 432 copied content files by hash and all relative manifest paths. Existing Git exclusion confirmed. HANDOFF_VISA_YOUTUBE.md documents coverage, quality, private handling and the prompt to register the new collection alongside Visa's essays. Sent the prompt to existing Summon task 01a076b2-d97e-71f2-b534-3280bf3b87ad. No deployment or public raw-corpus publication.
<!-- END:imported-codex-context -->
<!-- BEGIN:codex-chat-continuation -->
Codex chat continuation: read `CLAUDE_CONTINUE_FROM_CODEX.md` to resume from the latest local Codex sessions for this project.
<!-- END:codex-chat-continuation -->
<!-- BEGIN:imported-claude-context -->
# CLAUDE.md - youchop.app

## October 12, 2026: Instagram transcription and Koerner AI evidence

Added free local Instagram/video-file transcription: tools/local_transcribe.py, loopback UI/server, npm run transcribe (127.0.0.1:8876), and extension v0.13.0 popup handoff. Uses local yt-dlp + faster-whisper CPU int8; no paid speech API, cookie export or audio upload. The supplied Forbes Reel DeKieZFiL7e downloaded anonymously and passed CLI/Helium UI extraction: 306 words, 85 seconds. File-upload path passed too. Model small cached; missing models download once. 32 Node tests and 4 Python tests pass, mobile UI 390px has no horizontal overflow. Actual saved extension reload was not performed; the independent local UI is running. Setup/limitations: INSTAGRAM-TRANSCRIPTS.md. Source/output and screenshots stay under ignored exports/.

Koerner Office root catalog refreshed: 454 Videos, 18 Live, 511 Shorts. Three YouTube captions (16,685 words) recovered before HTTP 429; two attempted entries require membership. Public podcast index has 380 episodes; 59 AI-title candidates, 11 recovered (96,089 words) before archive HTTP 429. Private collection exports/koerner-2026-10-12/ distinguishes editions and is not a complete-channel corpus. AI-BUSINESS-EVIDENCE-2026-10-12.md under exports/ reviews targeted Koerner, Starter Story and Greg Isenberg cases with sources and self-reported-earnings limitations. No immediate rate-limit retry, paid provider, deployment, publication, outreach or cross-project handoff.

## October 6, 2026: Naval channel reconciliation

Official channel @NavalR now lists 175 Videos and 93 Shorts, 268 unique uploads; no Streams collection returned. Previous summon.company/knowledge/naval corpus had 159 transcripts from the 175-video catalog and excluded Shorts. New private snapshot exports/naval-2026-10-06/ reuses those 159 by ID and recovers the remaining 16 regular-video texts from official nav.al posts verified by exact YouTube links. All 175 regular uploads have documents, 371,941 words total; 93 Shorts remain missing. Original corpus preserved. Combined corpus, source-linked index, caption timing where available, raw sources and hashes verified. Official publisher text may be edited; audio accuracy and ending completeness remain unverified. Recent YouTube HTTP 429 prevented caption retrieval for Shorts; no immediate retry, paid provider, deployment, publication or project handoff. Git/Vercel exclude exports/.

## October 6, 2026: Dalton + Michael channel

Whole public channel catalog contains 37 Videos and 27 Shorts (64 unique IDs; no Streams tab returned). Direct caption retrieval hit HTTP 429 on the first video (7TU636F_yVQ) and stopped. Recovered 26/37 regular-video transcripts, 85,538 words, from public Celaeno pages matched by exact YouTube source ID. No Shorts recovered: 38 total gaps. Private output: exports/dalton-michael-2026-10-06/, including corpus.md, INDEX.md, README.md, QUALITY.md, per-video documents, original HTML/catalog and manifest hashes. Text accuracy and ending completeness not checked against audio; no timestamps invented. Archive text is not represented as YouTube-original captions. Git and Vercel exclude exports/. No paid provider, immediate 429 retry, deployment, publication or project handoff.

## September 22, 2026: Tim Ferriss / Kevin Rose Random Show

Private corpus at `C:/Users/adamp/.local/share/youchop/corpora/random-show/2026-09-22/`: 28 numbered podcast episodes, 537,993 words. Reused 25 official blog transcripts from summon.guide's August 24 archive and fetched official PDFs for episodes 24, 46 and 146 (109 pages total). Live official post/transcript sitemaps checked for additional matching URLs; latest included is episode 875 (July 16, 2026). Combined corpus, episode index, 28 individual documents, manifest with verified SHA-256 hashes, raw sources, quality notes and rebuild script saved privately. Earlier unnumbered/video editions catalogued separately, not counted as podcast transcript coverage. No Unicode replacement characters found; audio accuracy remains unverified. No paid provider, deployment or cross-project handoff. Old ObsidianVault/Notes/Library path was absent at extraction time, so this corpus uses the private local-share path above.

## September 13, 2026: Greg Isenberg, Jim Fung and EO corpora

Extracted three public Videos-tab channels, all durations, with `tools/corpus-reconcile.mjs` (local yt-dlp, no hosted provider): first pass on September 11, one retry pass on September 13 for transient read timeouts, no HTTP 429 in either. Private snapshots: `C:/Users/adamp/ObsidianVault/Notes/Library/<Name>/sync-2026-09-11-retry/` is canonical for each; the first-pass `sync-2026-09-11/` directories hold cached files referenced by absolute path and must be kept. Each canonical directory has `corpus.md`, `INDEX.md`, `QUALITY.md`, `README.md` (coverage, gaps, resume command), manifest, per-video `<id>.md` and `<id>.timed.md`, and raw captions in `_subs/`.

- @GregIsenberg: 446 listed, 445 transcripts, 3,414,581 words. 367 reused by video ID from `summon.company/knowledge/greg-isenberg` (July 22 corpus, left untouched). One gap, `xLa-9_gi7Wg` (no English captions). One possible early ending, `x_icl0CzOfA` (captions end 55 seconds before its 54:50 listing).
- @jimmyfung_: 155 listed (one uploaded after September 11), 155 transcripts, 954,130 words, no gaps.
- @eoglobal: 282 listed, 282 transcripts, 842,503 words, no gaps. 19 possible early endings (captions end 31 to 41 seconds before the listed duration; EO videos carry music and end cards, so most are likely outros, but they were not checked against the audio). `summon.company/knowledge/eo/` is an empty earlier attempt and was not used.

Verified per snapshot: every manifest path resolves, per-video file counts and corpus sections equal availability, no stray files. Caption accuracy is not independently verified. Em dashes inside the Greg and EO corpora are verbatim YouTube titles (`153EkQiLmf0` and 3 EO titles), kept as source data. No deployment, publication, paid fallback, immediate 429 retry, or cross-project handoff.

Tool note: `tools/corpus.mjs` passes `--ignore-errors` to yt-dlp, so under rate limiting it records a 429 as "no captions". Prefer the reconciler when YouTube has been throttling; it stops on the first access error and records it.


## September 13, 2026: @visakanv corpus

Extracted public Videos-tab uploads, all durations, with local yt-dlp: 460 listed, 429 transcripts, 1,212,515 words. Twenty videos had no usable English captions; HTTP 429 on `oRYtFYZT_qc` stopped retrieval, leaving ten unattempted (31 total gaps). Private output: `C:/Users/adamp/ObsidianVault/Notes/Library/Visakanv/sync-2026-09-13/`, with combined corpus, index, 429 timestamped documents, raw captions, manifest and quality report. All 429 paths verified; no possible early endings under the 30-second threshold, but transcription accuracy is unverified. Private README records cooldown/resume guidance. No paid fallback, immediate retry, deployment, publication or cross-project handoff.

## September 12, 2026: research handoffs

Adam explicitly requested a GDC knowledge-base copy inside Eyeland and a learning prompt. Copied 1,783 timed documents plus combined corpus, index and quality/provenance to `eyeland.cards/knowledge-private/gdc/`; 1,786 copied content files hash-verified and the destination manifest uses relative transcript paths. Git and Vercel exclude `knowledge-private/`. `HANDOFF_GDC_FROM_YOUCHOP.md` contains the durable prompt; sent it to the existing Eyeland task `01a07a68-c70e-7dc3-ad79-36883192f4cd`. The original vault corpus is preserved.

Sensible Transfers extraction complete: 136/137 selected videos, 530,777 words, across Tifo Football, The Athletic FC and The Athletic FC Podcast public Videos tabs. Missing captions: `E3CZvflW0mw`; possible early ending: `oUHmzg2G8JI`; no rate-limit stop. Private library: `ObsidianVault/Notes/Library/SensibleTransfers/sync-2026-09-12/` under Adam's home. Verified local copy in `darktalent.tech/knowledge-private/sensible-transfers/`, excluded from Git/Vercel, with 139 copied content files hash-verified and portable manifest paths. DarkTalent's `SENSIBLE-HIRES.md` and `HANDOFF_SENSIBLE_TRANSFERS.md` preserve Adam's company-diagnosis → tech-talent-market → sensible-hires series/agency concept and existing ECOSYSTEM.md roles. Eyeland completed its GDC research pass in `game/GDC-LESSONS.md`; playtests remain proposals.

## September 11, 2026: GDC corpus

Official channel now uses `@GDCFestivalofGaming` (channel ID `UC0JB7TSe49lg56u6qH8y_MQ`; old `@Gdconf` returns 404). Private library: `C:/Users/adamp/ObsidianVault/Notes/Library/GDC/merged-2026-09-11/`. Live public Videos-tab catalog: 1,916 videos, all durations. Available: 1,783 transcripts / 13,066,052 words, comprising 1,738 ID-matched community Whisper transcripts from `dklassic/GDC-transcript` commit `aa864490ba81ae02da84fe769042ea938e3a73a1` and 45 locally fetched YouTube English captions. Archive provenance recorded privately; explicit disallowance entries excluded. YouTube HTTP 429 on `jbZ3ntEvs4Y` stopped further retrieval: 5 no-captions, 1 blocked, 127 unattempted gaps. No immediate retry or paid fallback. Combined `corpus.md` is ~81 MB; `INDEX.md` links all individual timestamped documents and missing videos. All paths verified; 68 possible early endings flagged, accuracy not independently checked. Resume instructions and archive sources are in private `GDC/README.md`; reuse the latest manifest into a new snapshot after cooldown. No deployment, publication, or Eyeland handoff for GDC.

## September 11, 2026: @adomakins corpus

Extracted Adam Skjervold's public Videos-tab uploads, all durations, via local yt-dlp: 257 listed, 255 English-caption transcripts, 541,894 words. No rate-limit stop. Missing English captions: `lSCOl3WMNuw` (Playing pickleball), `XMhNSxHTwXI` (Lightweight Flywheel Install and Review (FULL)). Private output: `C:/Users/adamp/ObsidianVault/Notes/Library/Adomakins/sync-2026-09-11/` containing `corpus.md`, `INDEX.md`, manifest, quality report and 255 per-video `*.timed.md` documents. All manifest paths verified; no caption end more than 30 seconds before listed duration. Caption accuracy is not independently verified. No hosted provider, deployment, publication or cross-project handoff requested or performed.

## September 11, 2026: Elan Lee corpus for eyeland.cards

Extracted @ElanLee public Videos-tab uploads with the local reconciler: 25 listed, 23 transcripts, two without English captions, no access-error stop. Private corpus lives in `C:/Users/adamp/ObsidianVault/Notes/Library/ElanLee/sync-2026-09-11/` with combined `corpus.md`, per-video timestamped Markdown, manifest/index, and quality report. 69,307 words; no caption end more than 30 seconds before the listed duration. Raw material stays outside public repos. `eyeland.cards/HANDOFF_FROM_YOUCHOP.md` supplies a concrete source-linked game-design learning task for the existing Eyeland task. No paid provider or deployment.

## September 10, 2026: Channel queue builder v0.12.0

- Channel-page **Build channel queue** replaces the old handoff to hosted `/extract`. Popup supports channels too. Latest / Most popular / Oldest, count 1–50, min/max minutes, and title-contains filters produce an editable preview. Filters apply before the requested count, preserving native YouTube order.
- `extension/channel-queue.js` reads public Videos-tab metadata in MAIN, uses YouTube’s actual sort continuation token, and paginates. It skips the separate sort-header reload action when selecting feed items. The injected function is a serializable function expression, with explicit error results across the extension boundary.
- Latest queue is saved under `youchop.channelQueue.v1` in local extension storage. Preview supports Remove, Watch queue (temporary YouTube `watch_videos` playlist), Download links, and Chop transcripts via the existing local playlist extractor. It does not save playlists to the YouTube account. Scan limit 2,000 videos / 70 pages is labeled if reached. Duration filters exclude unknown durations; missing matches are reported honestly.
- Live Helium: latest first `OV09yPLf8BI`, popular first `8xgnm6SynH4`, oldest first title “How To Make $30K/month With Cooking”. Duration filter returned 21:49 and 23:36 videos; title filter returned three SaaS videos. Reopening restored the filter and queue. Watch generated a temporary playlist with the exact three IDs in order. Removing two and chopping the remaining `BA_fC95p43c` produced one Markdown document, 22,801 characters, local/free.
- `npm test`: 30 tests, including filter-before-limit, ID deduplication, native sort pagination with separate header updates, serialization, and reader error propagation. v0.12.0 loaded from the saved extension path. No site deploy or hosted provider used.
- Recording: `C:\Users\adamp\.config\browser-harness\agent-workspace\recordings\youchop-channel-queue-v0120`.
- Final pagination check built 50/50 Latest videos across multiple pages; builder left open on Starter Story. Final extension inspection: v0.12.0, zero runtime and manifest errors.

## September 10, 2026: Productize skill test

- Added `PRODUCTIZE.md`: bounded creator chapter-pack offer, evidence audit, labor sensitivity, and a proposed external sample test. No commercial terms or runtime behavior changed.
- Found $99 in OFFER.md versus $49 in creators.html; source already contains a Stripe pack link, contrary to older STATUS.md. Checkout amount and current customer revenue remain unverified.
- Existing-chapter guard limits the offer to unchaptered videos. `npm test` passed 26/26; this establishes local behavior, not demand. External use is the binding evidence gap.
- Reusable skill: `C:/Users/adamp/.codex/skills/productize/SKILL.md`. Next: resolve price conflict and obtain an owned/permitted sample input. Preserve other ongoing extension/corpus work.

## September 6, 2026: Extension stalled-loader retry fix

- Pasted failure log #9 (v0.11.0, `Z9iksIAXcbk`) showed the failed native loader running twice; 50 timer ticks took 244 seconds in the second attempt. Zero-size transcript panels alone are not proof of failure: the same layout succeeded in today's baseline and verification.
- v0.11.1 retains a priming failure for the current extraction, so the fallback does not repeat it. Native and panel waits now use elapsed-time deadlines. A 12-second worker response watchdog bounds the MAIN-world request independently of page timer throttling; a late reply is ignored. This is not an overall extraction deadline, and a suspended page still needs to resume to process results.
- Transcript chip selection now uses the nested button and honors its selected state.
- `npm test`: 26/26 pass, including duplicate-failure prevention, selected chip behavior, worker timeout/late completion, and a simulated minute-long background timer delay.
- Reloaded saved unpacked extension in Helium as v0.11.1, zero manifest/runtime errors at reload. Fresh local extraction on `Z9iksIAXcbk`: 574 unique lines, 22,007 characters, final timestamp 921s of 923s, 7.7 seconds. Second extraction: browser-cache, 17ms. Clicking the actual Chop button displayed all 22,007 characters with the saved-transcript label.
- Historical HTTP 400/402 failure did not reproduce today; timeout failure behavior is covered by tests, not claimed as a reproduced live outage. No hosted provider, deployment, publishing, download, or clipboard action used.
- Recording: `C:\Users\adamp\.config\browser-harness\agent-workspace\recordings\youchop-transcript-v0111`.

## September 6, 2026: Starter Story coverage audit

Latest pickup sync: **179/181** available, two missing (`NFWV9wxRuv4`, `hCvy-Rt7Naw`). Three additional transcripts recovered; HTTP 429 stopped retrieval again. `--reuse MANIFEST` now carries forward prior snapshots; future syncs request one English track to avoid duplicates (not yet live-verified). Four focused tests pass. Latest private snapshot: `ObsidianVault/Notes/Library/StarterStory/sync-2026-09-06-2010` under Adam's home. See `STARTER-STORY-SYNC.md` before resuming; preserve the rate-limit cooldown.

Added non-destructive `tools/corpus-reconcile.mjs` and three passing focused tests. All-duration public upload coverage is 176/181 after one local caption recovery, not the 16 entries in the old 20-minute-filtered manifest. Five are missing and YouTube HTTP 429 stopped further retrieval. Original corpus preserved, private snapshot and analysis stay outside this public repository. No hosted quota, deployment or recurring automation used. See `STARTER-STORY-SYNC.md` for scope and continuation.

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

**Real chapters for every YouTube video.** A Chrome extension that reads a video's transcript and renders AI-generated, clickable chapters in YouTube's own player UI (seekbar segments + chapter list), plus a creator service that chapterizes entire back-catalogs.

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

**This is a rebuild.** The original Next.js app + extension source lived in `adamtpang/youchop.app` on GitHub, which was deleted; only the Vercel deployment survived (source unrecoverable for git deploys). Check [github.com/settings/deleted_repositories](https://github.com/settings/deleted_repositories), if the repo is still restorable, the extension source comes back with it.

- Extension: built historically, **never published** to the Chrome Web Store; source lost pending repo restore (else rebuild).
- The old deployed site's `/credits` page still says "Chaptr" (previous name) and its purchase buttons have no backend.
- Business model: **creator-revenue-first**. Presell the $99 pack with manual fulfillment starting now; the viewer extension is distribution, samples, and proof, not the business.

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
```

## Extension native continuation fix and trace (2026-08-30)

- Helium loads the unpacked extension from
  `C:\Users\adamp\Aether\youchop.app\extension`. It was still v0.8.9 while the
  first transcript-spinner fix existed only in a Codex worktree. The validated
  extension files are now synchronized to this saved project.
- v0.9.1 added a chronological, privacy-safe failure trace with runtime versions,
  panel waits and chip selection, response statuses and byte counts, parser counts,
  and a final DOM snapshot. It never includes cookies, API keys, visitor data,
  continuation values, response bodies, or transcript text.
- The live trace showed that a reconstructed `/youtubei/v1/get_transcript` POST
  receives HTTP 400 `FAILED_PRECONDITION`, even with the command's click-tracking
  context. Calling YouTube's continuation element `triggerContinuation()` instead
  returned HTTP 200 and rendered 326 transcript rows on `Xc0ERidGLJc`.
- v0.9.2 now uses YouTube's native continuation method first and retains the
  reconstructed request only as a compatibility fallback. Live Helium verification
  passed from this saved extension path with no manifest or runtime errors:
  `Xc0ERidGLJc` completed in about 3 seconds, rendered 326 YouTube rows, harvested
  323 unique lines, and produced 12,038 characters through the local free path.

## Extension local chapter and playlist path (2026-08-30)

- v0.10.0 sends the already-extracted timestamp rows to `/api/chapterize`.
  The endpoint labels the source `browser-local` and skips TranscriptAPI,
  Supadata, and Apify instead of refetching the same transcript.
- Chapter output is shown in an editable field with a `https://youchop.app` watermark and is
  copied only after a second explicit click. YouChop never posts to YouTube and
  grants no credit or other reward for copying, pasting, or commenting.
- Public playlist pages and watch URLs with `list=` now expose **Chop playlist**.
  The extension lists videos through `/api/playlist-videos`, processes up to 50
  videos sequentially in temporary inactive YouTube tabs, closes only its own
  tabs, and emits a linked Markdown corpus with per-video failures.
- Playlist transcript extraction is local-only. It does not fall back to hosted
  transcript providers, so exhausted provider credits cannot consume a playlist
  run. Chapter generation still sends transcript text to youchop.app and may use
  Anthropic, as documented in `extension/README.md`.
- Verification command: `node --test extension/lib.test.cjs api/chapterize.test.cjs`.
  The suite currently has 18 passing tests covering local-row chapterization,
  playlist URL detection/rendering/message dispatch, and prior transcript fixes.
- Live Helium verification found and fixed YouTube's current playlist-header host
  (`.metadata-buttons-wrapper`). The saved extension reloaded as v0.10.0, showed
  **Chop playlist** on Ben Cera's 35-video uploads playlist, and advanced through
  local temporary-tab extraction. A cancellation check also exposed tabs that
  could remain alive long enough to autoplay. Jobs now track tab ids, pause and
  mute media, cancel explicitly when the panel closes, and retry tab cleanup.
  The repeat run left zero new YouTube watch tabs after cancellation.

## Duplicate guard, full-video chapters, and production deploy (2026-08-30)

- Extension v0.10.1 and `/api/chapterize` now refuse duplicate work when YouTube
  already exposes creator or automatic chapters. Detection covers macro-marker
  panels and valid description timestamp sequences. The API returns HTTP 409
  `already_chapterized` before using transcript-provider or model quota.
- Extension v0.10.2 hides the chapterize button entirely when the live YouTube
  page already exposes macro markers or a valid timestamp sequence in its
  description. The server-side HTTP 409 remains the stale-client backstop.
  Live Helium verification on `Z9iksIAXcbk` found one macro-marker panel,
  extracted 22,007 characters locally, and confirmed the chapterize button's
  computed and inline display were both `none`.
- The explicit 20-chapter ceiling was removed from the heuristic, Anthropic
  prompt, and model-output parser. A deterministic coverage pass fills oversized
  gaps if model output ends early, and an incomplete local transcript returns HTTP
  422 instead of producing a partial chapter list.
- Attributed output now ends with `⏱ Chapters by https://youchop.app`.
- Production deploy: Vercel deployment `dpl_AG8ceqJ2gnJVnRouRL2AAVgYYGPw`,
  aliased to `https://youchop.app`. Inspector:
  `https://vercel.com/adamtpangs-projects/youchop.app/AG8ceqJ2gnJVnRouRL2AAVgYYGPw`.
- Live API canaries passed: a 65-minute synthetic local transcript returned 26
  chapters through `browser-local`, reached its final row, and included the URL
  watermark. `Z9iksIAXcbk` returned HTTP 409 because YouTube already exposes
  chapters for it. The rendered `/chop` page showed the same duplicate warning.
- The production file allowlist remains controlled by `.vercelignore`; local
  exports, agent state, Markdown handoffs, tests, and extension source are not
  published by the site deploy.
- Helium reloaded the unpacked extension from
  `C:\Users\adamp\Aether\youchop.app\extension` and confirmed version 0.10.3 with
  no extension errors. It remains unpublished to the Chrome Web Store.
- Browser evidence:
  `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-prod-deploy-20260830-v0101`
  and
  `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-prod-duplicate-guard-20260830-retry`.

## Deploy configuration

- Platform: Vercel
- Project: `youchop.app` (`prj_wdbsn1IIESiWsAPGIw8JQDGf3Gz7`)
- Production URL: `https://youchop.app`
- Command: `vercel deploy --prod --scope adamtpangs-projects --yes --logs --no-color`

## Per-video playlist Markdown files (2026-08-30)

- Extension v0.10.4 no longer presents a chopped playlist as one concatenated
  transcript. The extraction job is unchanged, but the result panel now has a
  transcript-file picker with one standalone document per successfully chopped
  video.
- Each Markdown document has its own `.md` filename, YAML frontmatter, source and
  timestamp deep links, playlist title, playlist URL, and playlist position.
  Copy and Download operate only on the selected file.
- Verification command: `node --test extension/lib.test.cjs api/chapterize.test.cjs`.
  The suite passes 19/19 tests, including isolation between two playlist documents.
- Live Helium verification reloaded the unpacked extension as v0.10.4 and chopped
  all 3 videos in private playlist `PLN0KY-6tdXjA`. The picker showed 3 distinct
  `.md` filenames; switching from file 1 to file 2 changed the title, video id,
  source link, playlist position, and transcript. No file was downloaded or copied.
  Evidence:
  `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-playlist-separate-markdowns-v0104-live`.

## Private playlist listing and visible button fix (2026-08-30)

- Exact reproduction: Adam's open playlist `PLN0KY-6tdXjA` is private and has
  three videos. The anonymous production endpoint returned HTTP 502 because
  YouTube told Vercel the playlist did not exist, while the signed-in Helium page
  rendered all three `ytd-playlist-video-renderer` rows.
- Extension v0.10.3 now reads rendered playlist rows locally before calling the
  public endpoint. This supports private and unlisted playlists available to the
  signed-in user without sending cookies or YouTube credentials to YouChop.
- YouTube currently keeps an obsolete zero-sized playlist header beside its
  visible header. The old injector selected the first action model, so the button
  existed at 0x0 pixels. Injection now selects a rendered host by geometry and
  relocates a stale hidden button when the visible header appears.
- Content scripts now expose a versioned cleanup hook. Future extension updates
  can replace their observer, timer, and runtime listener safely; older playlist
  tabs receive one reload during the v0.10.3 upgrade.
- Live Helium verification confirmed a visible 304x36 `Chop playlist` button,
  local listing advanced immediately to `chopping video 1 of 3`, cancellation
  removed the panel, and zero temporary watch tabs remained. Evidence:
  `C:\Users\adamp\Aether\helium-harness\.helium-harness-dev\agent-workspace\recordings\youchop-private-playlist-fix-v0103`.

## Transcript reuse cache (2026-08-31)

- Extension v0.11.0 stores successful transcript segments in
  `chrome.storage.local` by video id and language. Entries expire after 90 days
  and are bounded to 80 transcripts and roughly 7 MB. Single-video extraction
  checks this cache before opening YouTube's transcript UI; playlist extraction
  checks it before creating a temporary watch tab.
- `api/transcripts.js` now stores successful provider-fetched public transcripts
  in Vercel Runtime Cache for 30 days. Timestamped rows are canonical, so clean
  and timestamped requests share one provider result. Cache failures fail open;
  transcript failures are never cached.
- Browser-local rows are intentionally not written to the shared server cache.
  This keeps private and signed-in playlist transcript text on the user's device.
- `npm test` passes 22/22 tests. The cache regression proves a clean request and
  a later timestamped request make one provider call total, and the extension
  regression proves a cache hit returns before any extraction path can open.
- Helium loaded the unpacked extension as v0.11.0 on `Z9iksIAXcbk` and opened
  the extraction panel. YouTube removed the injected panel while opening its
  transcript UI in the automated run, so this session does not claim a completed
  second-click browser proof. Recording:
  `C:\Users\adamp\.config\browser-harness\agent-workspace\recordings\youchop-transcript-cache-v0110-paused-target`.
- This cache revision has not been deployed. The shared Vercel Runtime Cache path
  does not affect production until Adam explicitly authorizes a production deploy.

## Visa handoff to summon.guide (2026-09-13)

At Adam's request, copied the 429-transcript Visa corpus into summon.guide/content/knowledge/visakan/_raw/youtube-2026-09-13/. Verified 432 copied content files by hash and all relative manifest paths. Existing Git exclusion confirmed. HANDOFF_VISA_YOUTUBE.md documents coverage, quality, private handling and the prompt to register the new collection alongside Visa's essays. Sent the prompt to existing Summon task 01a076b2-d97e-71f2-b534-3280bf3b87ad. No deployment or public raw-corpus publication.
<!-- END:imported-claude-context -->
<!-- BEGIN:claude-chat-continuation -->
Claude chat continuation: read `CODEX_CONTINUE_FROM_CLAUDE.md` to resume from the latest local Claude Code sessions for this project.
<!-- END:claude-chat-continuation -->
<!-- BEGIN:summon-standard -->
September 10 channel queue: extension v0.12.0 adds local channel queues with native Latest/Popular/Oldest sorting, count 1–50, duration/title filters, saved preview, temporary YouTube playback playlist, link download, and local transcript extraction. See `CLAUDE.md` and `extension/README.md`. No site deployment.

September 6 extension update: v0.11.1 is loaded in Helium from the saved extension directory. Failed native-loader priming is reused rather than retried, waits use elapsed-time deadlines, and the worker bounds MAIN response waiting. 26 tests pass. Live `Z9iksIAXcbk` extraction returned 574 lines / 22,007 characters in 7.7 seconds; cache reuse took 17ms and the visible Chop panel showed the full result. See `CLAUDE.md` for evidence and limits.

September 6 Starter Story handoff: read `STARTER-STORY-SYNC.md`. Latest all-duration, ID-based sync reached 179/181 available. Two missing, HTTP 429 stopped retrieval, no paid fallback or deployment. Resume with `--reuse` pointing to the latest private manifest. Original corpus is preserved; private transcript snapshots and personal analysis stay outside this public repository.

Summon standard: this company must pass the six readiness gates in `summon.company/SUMMON_COMPANY_STANDARD.md` (Outcome, Evidence, Workspace, Organization, Skills, Runtime). Read `NORTH_STAR.md`, `EVIDENCE.md`, `company/ORGANIZATION.md`.
<!-- END:summon-standard -->

<!-- BEGIN:grok-chat-continuation -->
Grok chat continuation: read `GROK_CONTINUE_FROM_CLAUDE.md` and/or `GROK_CONTINUE_FROM_CODEX.md` when resuming in Grok. Refresh with `node .grok/sync-to-grok.js` from Aether root.
<!-- END:grok-chat-continuation -->

<!-- BEGIN:claude-codex-sync -->
# Claude/Codex sync

Before making changes, read `CLAUDE.md` in this project if it exists. It is the live handoff from Claude Code and the source of truth for current project progress, design decisions, constraints, and open tasks. Keep future progress updates there so Claude and Codex stay in sync.

If this file contains older project context that conflicts with `CLAUDE.md`, prefer `CLAUDE.md` unless the user says otherwise.
<!-- END:claude-codex-sync -->
