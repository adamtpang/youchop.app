// vitals.data.js — YouChop's company vitals. Source of truth for vitals/index.html.
// Operated by Claude ("log this week", "check off X", "set <metric> to N", "add a decision").
// Model: creator-revenue-first (B-first), viewer extension = distribution + samples.
// Full reasoning: ../STRATEGY.md · growth loops: ../GROWTH.md · numbers: ../ECONOMICS.md

window.VITALS = {
  company: "YouChop",
  tagline: "Real chapters for every YouTube video.",
  mission: "Make every long video on the internet navigable — no one should scrub blind through two hours looking for one moment.",
  problem:
    "Most long YouTube videos never get chapters. Viewers scrub blind; creators' back-catalogs are invisible to Google Key Moments search. Creators pay $19–39/mo for per-video chaptering, and nobody offers whole-back-catalog chapterization at a fair price.",
  northStar:
    "Paying Creator Channels (PCC): channels that bought the $99 back-catalog pack or hold the $12/mo continuity sub. Now: 0. 90-day target: 10. Guardrail: Weekly Active Choppers (bear 40 / base 75 / bull 150).",

  knowledgeBase: [
    { file: "README.md", desc: "What YouChop is, current state, how to work on it" },
    { file: "STRATEGY.md", desc: "Positioning, north star, kill gates, moat — the red-teamed operating model" },
    { file: "GROWTH.md", desc: "The two loops: creator sample outreach + compliant copy-paste comments" },
    { file: "ECONOMICS.md", desc: "Cost per chop, pricing, margins, path to $1k/month" },
  ],

  // savings is a PLACEHOLDER — replace with the real figure (this-week task).
  // expenses: domain+hosting ~$20, LLM API ~$30, Stripe/tooling $15, alerting $10, outreach samples ~$20.
  finances: { income: 0, expenses: 95, savings: 10000 },

  metrics: [
    { label: "Paying creator channels", value: 0, target: 10, hint: "north star", key: "pcc",
      next: "Send the first 10 'free chapters for your top 5 videos — the other 195 for $99' emails this week. No new code needed." },
    { label: "Outreach reply rate %", value: 0, target: 10, hint: "kill gate: <3% at 300 sends", key: "reply",
      next: "Ship /creators with the free-sample mechanic so every email has a destination that converts." },
    { label: "Weekly active choppers", value: 0, target: 75, hint: "guardrail · bear 40 / bull 150", key: "wac",
      next: "Publish the extension to the Chrome Web Store — title: 'YouChop — AI Chapters & Timestamps for YouTube'." },
    { label: "Install → first-chop %", value: 0, target: 55, hint: "activation", key: "activation",
      next: "Grant 1 anonymous device-scoped credit so the first chop runs before signup." },
    { label: "Paste-comment survival %", value: 0, target: 80, hint: "loop kill switch at <60%", key: "survival",
      next: "Weekly incognito spot-check of 10 pasted comments once the loop is live." },
  ],

  charts: [
    { label: "Paying creator channels", key: "pcc", color: "var(--amber)" },
    { label: "Weekly active choppers", key: "wac", color: "var(--green)" },
  ],

  streak: 1,
  // Claude appends weekly: { t: "Jul 9", pcc: 0, reply: 0, wac: 0, savings: 10000 }
  history: [
    { t: "Jul 2", pcc: 0, reply: 0, wac: 0, activation: 0, survival: 0, savings: 10000 },
  ],

  goals: [
    { text: "10 Paying Creator Channels — presell with manual fulfillment, 10–25 sample emails/week", done: false },
    { text: "Ship the revenue surface: /creators page + demo + live checkout", done: false },
    { text: "Viewer funnel to 75 WAC: publish to CWS, anonymous first chop, 10+ reviews", done: false },
    { text: "De-risk: canary chop + status banner, funnel events, real savings figure in vitals", done: false },
  ],

  products: [
    { name: "Channel → Text — extract a channel's transcripts for LLMs (/extract)", status: "Live" }, // needs YT_TRANSCRIPT_TOKEN env for live data
    { name: "Chrome extension (native-UI chapters)", status: "Building" }, // built but unpublished — source lost with repo; rebuild/restore
    { name: "Landing page rebuild + animated demo", status: "Live" },
    { name: "Creator back-catalog pack — $99/200 videos (manual fulfillment)", status: "Building" },
    { name: "/creators page + free-sample mechanic", status: "Live" },
    { name: "Paste-a-URL web fallback (CWS takedown hedge)", status: "Next" },
    { name: "Bulk automation via OAuth captions.download", status: "Next" },
    { name: "$12/mo auto-chapter continuity sub", status: "Next" },
    { name: "Agency SKU $199–299/catalog", status: "Next" },
    { name: "Firefox/Edge ports · Viewer Pro $3.99/mo (only if WAU>5k)", status: "Later" },
  ],

  roadmap: [
    { stage: "0 · Foundation (this week)", items: [
      { label: "Landing page + /creators live with honest CTAs", done: true },
      { label: "vitals dashboard + strategy docs in repo", done: true },
      { label: "Recover or rebuild the extension (check GitHub deleted-repos restore)", done: false },
      { label: "Hourly canary chop + in-extension status banner", done: false },
      { label: "Server-side funnel events in one Postgres table", done: false },
      { label: "Replace $10k savings placeholder with real figure", done: false },
    ] },
    { stage: "1 · Creator presell + distribution (starts NOW)", items: [
      { label: "10–25 sample emails/week — max 5 sample videos/channel", done: false },
      { label: "Live Stripe checkout on /creators ($99 pack)", done: false },
      { label: "Publish extension to CWS — chapters/timestamps keyword title", done: false },
      { label: "Anonymous first chop (1 device-scoped credit)", done: false },
      { label: "Copy-paste block: URL-free rotating watermark, +1 credit on copy", done: false },
      { label: "Paste-a-URL web fallback ships BEFORE paste loop defaults on", done: false },
      { label: "Price-test $99 vs $79 on first 10 sales", done: false },
    ] },
    { stage: "2 · Bulk + recurring (gate: 5 presold packs OR 10% reply)", items: [
      { label: "OAuth captions.download primary path — test on 20 real channels", done: false },
      { label: "Throttled extension-fetch fallback, dry-run on own account", done: false },
      { label: "$12/mo continuity sub attached to every pack sale", done: false },
      { label: "Agency SKU ($199–299/catalog)", done: false },
      { label: "Whisper fallback prototyped + contingency pricing ($149/200)", done: false },
      { label: "Monthly 5-video native-quality canary (85% = pivot trigger)", done: false },
    ] },
    { stage: "3 · Durable (gate: survives a YouTube change + a CWS scare)", items: [
      { label: "Firefox + Edge ports", done: false },
      { label: "Published cache data-retention/privacy position", done: false },
      { label: "Cache hits free-to-view for everyone", done: false },
      { label: "Viewer Pro $3.99/mo (only if WAU > 5k)", done: false },
    ] },
  ],

  org: [
    { fn: "Product & Engineering", now: "Adam (solo) — honest MTTR 2–4 days; canary + banner buy patience", next: "Contractor retainer funded from first pack revenue" },
    { fn: "Growth & Creator Outreach", now: "Adam — 10–25 sample emails/week, hours on the scorecard", next: "Part-time VA when outreach >10 hrs/wk AND reply >8%" },
    { fn: "Ops & Compliance", now: "Adam — 24h SLA on any CWS policy email; break-fix preempts portfolio", next: "No hire — automate (canary, survival checks)" },
  ],

  decisions: [
    { date: "2026-07-02", decision: "Compliance stance: NEVER auto-post to YouTube", why: "Automated commenting is an unambiguous ToS violation and CWS spam trigger; ~80% of the loop's value survives manual paste. Copy credit is +1, granted on copy. Watermark is URL-free ('⏱ Chapters by YouChop', rotating phrasings) — links get comments silently held. The loop is an instrumented experiment with a shutdown switch: <60% comment survival for 2 checks, or one creator complaint → watermark opt-in, credit dies.", revisit: "Weekly survival checks; loop design if share conversion < 1 new user per 200 chops for 2 months." },
    { date: "2026-07-02", decision: "B-first: presell the $99 creator pack NOW with manual fulfillment", why: "Creators demonstrably pay (TimeSkip $19–39/mo, ChapterMe $24/mo); viewers don't (60+ free tools, Eightify's $4.99 is the ceiling, TimeSkip's ~2k users is the honest demand base rate). The demand test needs zero new code — chop 3–5 sample videos per target channel and email them. Bulk engineering is gated on 5 presales or 10% reply rate, never on viewer metrics.", revisit: "If 300 sends yield <3% reply or <5 paid: reposition to agencies; if that fails 200 more sends, clean shutdown." },
    { date: "2026-07-02", decision: "Bulk architecture: OAuth captions.download primary, throttled extension-fetch fallback", why: "The buyer owns the videos — creator-consented API access is the one ToS-clean path that survives any transcript-scraping lockdown (converts fatal platform risk into quota management). No server-side YouTube scraping, ever. Whisper contingency pre-priced at $149/200 videos so the fallback can't fulfill at negative margin.", revisit: "If captions.download quota/coverage fails the 20-channel test." },
    { date: "2026-07-02", decision: "Pricing: $99 one-time / 200 videos + $12/mo continuity sub; sample-only pre-sale", why: "$39 would donate surplus against every anchor (ChapterMe $2.40/video, TimeSkip $0.78–1.27/video; $99 = $0.50/video, still 2–5x cheaper). The one-time pack ends the relationship — the sub is the actual MRR and the moat. Full-catalog demos would burn $160–440/mo pre-sale COGS; samples cost $0.05–0.15/prospect.", revisit: "Reprice after 10 sales on observed close rate; agencies may support $299+." },
    { date: "2026-07-02", decision: "North star = Paying Creator Channels; WAC demoted to banded guardrail", why: "The viewer extension is the demo and the distribution, not the business. Banded WAC targets (bear 40 / base 75 / bull 150) make a miss carry decision content — 150 as a single target needed four stretch levers at ~6% joint probability. 60% of weekly hours go to whichever scorecard is furthest below plan.", revisit: "Once bulk revenue exists, add packs+subs/month as a formal funnel." },
    { date: "2026-07-02", decision: "Demand kill gates logged with the same rigor as the Gemini trigger", why: "The likeliest death is demand failure, not YouTube. Viewer gate: day-120 WAC <50 → kill viewer roadmap, go creator-only. Creator gate: 300 sends at <3% reply or <5 paid → reposition to agencies, then clean shutdown. A WAC miss kills a roadmap, not the company — only creators were ever the business.", revisit: "Fixed; only evidence of a different buyer (podcast networks) reopens them." },
    { date: "2026-07-02", decision: "New wedge shipped: 'Channel → Text' — pull a whole channel's transcripts as copy-paste LLM context (/extract, via youtube-transcript.io API)", why: "Feeding YouTube into Claude/ChatGPT/Cursor is a sharper, more current pain than viewer chapters, and it reuses the same transcript infrastructure. It's a consumer-utility wedge with a clear job-to-be-done ('put a creator's brain in my context window'). Shipped as a first-class tool alongside chapters; not yet decided whether it becomes THE primary product. Uses youtube-transcript.io: transcripts endpoint (any paid tier) + channels endpoint (Plus $9.99/mo). Token stays server-side; mock mode ships so the flow demos without a key.", revisit: "If /extract usage clearly outpaces the chapters/creator funnel, promote it to the north-star product and re-orient the site around it. Decide after 2–3 weeks of real usage." },
    { date: "2026-07-02", decision: "Rebuilt from scratch after source loss; everything lives in git from day one", why: "The original GitHub repo was deleted (with the Lovable purge) and the local folder was emptied — only the Vercel deployment survived, unrecoverable for git deploys. The business now runs from this repo: landing, /creators, vitals dashboard, strategy docs.", revisit: "If github.com/settings/deleted_repositories still has youchop.app, restore and merge the extension source." },
  ],
};
