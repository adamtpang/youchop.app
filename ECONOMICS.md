# YouChop — Unit Economics

*Computed 2026-07-02. The founder's hypothesis — "past tools died because per-video AI cost was uneconomical; cheap LLMs flip it" — checks out directionally, with one twist: the cost advantage belongs to everyone now, so cost is not a moat.*

## Cost per chop (2026)

At ~150 wpm, transcripts ≈ 3k tokens (15 min) / 12k (60 min) / 24k (120 min).

| Model class | 15 min | 60 min | 120 min |
|---|---|---|---|
| Haiku-class ($1/M in, $5/M out) | ~$0.005 | ~$0.015 | ~$0.027 |
| GPT-mini-class ($0.25/M in, $2/M out) | ~$0.0015 | ~$0.004 | ~$0.007 |

Batch APIs halve these for bulk jobs. **GPT-3 era (2021–22): ~$0.25–0.50 per 60-min chop** (davinci $20/M, 4k ctx, chunk+merge) — 60–100x today, at worse quality. That's the graveyard explained (VidChapter discontinued 2026-03; ChapterMe still priced at $2.40/video from that era).

## The real COGS wildcard: transcript fetch, not the LLM

- YouTube blocks datacenter IPs for transcript scraping; residential proxies cost $5–10/GB (~$0.003–0.01/fetch) and PoToken bot-detection keeps escalating.
- **Fix, viewer flow:** fetch client-side in the extension using the viewer's own session — near-zero cost, robust.
- **Fix, bulk flow:** YouTube Data API `captions.download` with the creator's OAuth consent — the buyer owns the videos; ToS-clean; converts lockdown risk into quota management. No server-side scraping, ever.

## Pricing & margins

| SKU | Price | COGS | Margin |
|---|---|---|---|
| Creator back-catalog pack (≤200 videos) | **$99 one-time** ($0.50/video; $0.25/extra) | ~$5 LLM | ~95% |
| Continuity sub (auto-chapter new uploads) | **$12/mo** | pennies/mo | 95%+ |
| Agency catalog | **$199–299** | same code path | 2–3x ticket |
| Viewer credit packs (price discovery only) | $9+ minimum (Stripe's $0.30+2.9% eats ~9% of a $5 pack) | $0.005–0.03/credit | 85–95% |
| Whisper contingency (if captions unavailable) | **$149/200 videos or $0.99/video** | $0.36/hr transcription | ~40%+ |

Anchors: ChapterMe $2.40/video · TimeSkip $0.78–1.27/video effective · $99 is still 2–5x cheaper per video. Price-test $99 vs $79 on the first 10 sales — at ~5 sales/month, testing high costs one sale; anchoring low is permanent.

**Why not $39:** it would donate consumer surplus against every anchor (buyers compare against $468/year alternatives) and make the Whisper fallback negative-margin.

## Outreach COGS (the number that almost got missed)

Samples at 3–5 videos/prospect = **$0.05–0.15 per prospect**, ~$5–15/week at full volume. Speculative full-catalog demos would have been $160–440/month — 2–6x the entire budget — for a ~$34 gross profit per sale. Hence the hard rule: sample-only pre-sale, tracked as its own expense line.

## Monthly expenses (~$95)

Domain + hosting ~$20 · LLM API ~$20–40 (hard cap with 50%/80% alerts) · Stripe/tooling $15 · alerting/monitoring $10 · outreach samples $5–15/week cap.

## The corpus brain SKU (added 2026-07-25)

Shape decided in STRATEGY.md: we ship an **export**, a ready-to-run local gbrain brain, not a
hosted search service. That choice is what keeps this line honest.

### Measured embedding cost

**In practice this is $0, because Voyage ships a 200M-token free tier.** A 200-video
catalog needs about 2.7M tokens, roughly 1.3% of that allowance, so a creator can index
their whole back-catalog without paying anyone. Note that Anthropic does not sell an
embeddings API at all, so "use Claude for this" is not an option: gbrain accepts OpenAI,
ZeroEntropy, or Voyage, and Voyage is both the cheapest and the most Claude-adjacent pick.

The table below is the paid fallback, priced at OpenAI list rates, for anyone past the free
tier. Token counts are real (word counts from the actual corpora, x1.33).

| Corpus | Words | Tokens | `3-small` @ $0.02/M | `3-large` @ $0.13/M |
|---|---|---|---|---|
| 48-episode Founders set (the tested one) | 840,544 | 1.12M | **$0.02** | $0.15 |
| 200-video creator catalog (the $99 pack) | ~2,000,000 | 2.66M | **$0.05** | $0.35 |
| Adam's full 9.5M-word library | 9,557,151 | 12.71M | $0.25 | $1.65 |

Embedding a creator's entire back-catalog costs about a nickel. This was the number worth
checking, because "add a vector database" usually means adding a recurring bill, and here it
does not.

### Who pays it: the buyer, not us

The export hands over a brain folder plus a one-command setup. The buyer sets their own
`OPENAI_API_KEY` and runs the index locally. **YouChop's marginal cost for this SKU is $0.**
No hosted database, no per-user storage, no cost that scales with customers. The free-tiers
-first rule in this document survives intact, and the existing transcript sourcing model
(free tiers, paid fallback) is untouched.

Storage: a 200-video brain is roughly 30 to 60 MB of PGLite on the buyer's own disk. Ours: nothing.

### Where it sits on the ladder

| SKU | Price | YouChop COGS | Margin |
|---|---|---|---|
| Back-catalog pack (existing) | $99 one-time | ~$5 LLM | ~95% |
| **Corpus brain add-on** | **+$49 one-time** with a pack, **$79 standalone** | **$0** (buyer's key) | **~100%** |
| Continuity sub (existing) | $12/mo | pennies | 95%+ |
| Agency catalog (existing) | $199-299 | same code path | 2-3x ticket |

$49 as an add-on rather than a separate product: the corpus already exists as a byproduct of
the pack, so the pack buyer is one command away from the brain. Standalone at $79 for
researchers and agencies who want the brain without the chapters.

The honest caveat on this pricing: it is anchored on value, not cost, because cost is zero.
The number is a guess until someone pays it. Price-test $49 against $29 on the first five
add-on sales, same discipline as the $99 vs $79 test.

### Do not book this revenue yet

The SKU is **gated on the conceptual-retrieval test in STRATEGY.md**, which has not passed.
Keyword retrieval alone returned weak answers on real questions. Until an embedded run shows
good cited answers to questions like "what do these founders say about pricing", this stays an
internal tool. Cost to settle it: $0.02 and one key.

## Path to $1k/month run-rate (honest decomposition)

- ~5 packs/month × $99 = $495 — **one-time, must be re-earned monthly by the outreach motion**
- ~40 continuity subs × $12 = $480 — **true MRR**
- Viewer revenue: **$0 in all plans until WAU > 5,000.** Extension free-to-paid reality: 0.5–2% of WAU. Credit packs stay live purely as price discovery. Free credits cost <$0.10/user — cheap insurance, never booked as revenue.
