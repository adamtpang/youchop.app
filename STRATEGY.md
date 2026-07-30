# YouChop — Strategy

*The operating model, produced 2026-07-02 from a 7-dimension market research pass + 3-lens adversarial red-team. The dashboard in `vitals/` tracks it; this file explains it.*

## The one-sentence plan

**Sell ten creators in ninety days with the product that already exists, and let the viewer extension do what it was always for — proof, samples, and installs.**

## Positioning

- **B-first, C as top-of-funnel.** The paid product is creator-side: chapterize a channel's entire back-catalog ($99/200 videos) + keep every new upload chaptered ($12/mo continuity sub). The viewer extension is free distribution that manufactures creator leads.
- **ICP (pays):** YouTube creators — and the editors/agencies serving 5–20 channels — in tutorial/education/podcast/interview niches, ~10k–500k subs, 100+ unchaptered back-catalog videos. Job-to-be-done: *make the entire library navigable and Google-indexable (Key Moments) without hours of manual timestamping.*
- **Secondary (never pays until WAU>5k):** power viewers of long-form video. They supply installs, samples, and the watermark loop.
- **One-liner:** *YouChop gives any YouTube video real chapters — in YouTube's own player for viewers, and across a creator's entire back-catalog in one click.*

### Why B-first

1. Creators demonstrably pay: TimeSkip $19–39/mo, ChapterMe $24/mo ($2.40/video). Viewers don't: 60+ free generators, Eightify's $4.99/mo is the ceiling, and TimeSkip's ~2,000 users after months live is the honest viewer-demand base rate.
2. **Extension-rendered chapters carry ZERO SEO value.** Google Key Moments only fire on description-pasted timestamps. The paste/outreach mechanic isn't a growth hack — it's the only bridge from viewer artifact to creator value.
3. The creator demand test needs **zero new infrastructure**: chop 3–5 sample videos per target channel with the existing single-video chopper, email them, ask for $99. Manual fulfillment. This week.
4. Nobody offers channel-level bulk chapterization at a fair price — TimeSkip and ChapterMe are per-video workflows. That's the white space.

## North star & scorecards

- **North star: Paying Creator Channels (PCC).** Now 0 → 10 in 90 days.
- **Guardrail: Weekly Active Choppers (WAC)**, banded — bear 40 / base 75 / bull 150 — 4-week rolling averages. Neither metric gates the other.
- **Resource rule:** 60% of weekly founder hours to whichever scorecard is furthest below plan.
- **Stage-2 gate:** bulk automation gets built after **5 presold packs OR sustained 10%+ outreach reply rate** — never gated on WAC.

## Kill gates (pre-committed)

- **Viewer gate:** day-120 WAC < 50 with all Stage-1 levers shipped → kill the viewer roadmap, go creator-only. (Kills a roadmap, not the company.)
- **Creator gate:** 300 personalized sends at <3% reply OR <5 paid conversions → the creator wedge as specced is falsified; reposition to agencies/editors as the buyer; if that fails a further 200 sends → clean shutdown.
- **Gemini gate:** monthly 5-video canary of YouTube's native auto-chapter quality against a pre-registered rubric; ~85% timing/label acceptability → sunset the viewer pitch, go all-in on the continuity sub, or execute the clean shutdown. Every outreach conversation logs the prospect's answer to *"would you still pay if YouTube's auto labels were this good?"*

## The moat (restated honestly)

1. The **creator bulk workflow** + editable SEO-labeled chapters as the creator's permanent asset.
2. The **proprietary lead list** of channels that received/accepted chapters.
3. The **continuity subscription** — the recurring relationship YouTube must beat on every future upload.

Explicitly NOT the moat: cheap LLM costs (every competitor has them) and the chop cache (demoted to a cost/latency feature — real UX advantage, zero network effect at this scale).

## Assumed window

12–24 months before Gemini-grade native auto-chapters commoditize single-video chopping. Convert the window into paying creator relationships.

## Competitive map (from research, 2026-07)

| Player | What | Threat |
|---|---|---|
| YouTube native auto-chapters | Default-on since 2021, generic titles, partial coverage | **Existential, slow-moving** — the reason for the window assumption |
| TimeSkip AI | Closest direct comp; chapters in player, $19–39/mo, ~2k users | High (direct) but tiny traction; beatable on native UX + bulk |
| ChapterMe | Creator SaaS incumbent, $24/mo for 10 videos | Medium — pre-cheap-LLM pricing is exactly what we disrupt |
| NoteGPT (400k users) / Eightify / Merlin | Sidebar summarizers, none render native chapters | Medium-high flanking — a sprint away from copying the UI trick |
| TubeBuddy / VidIQ | Creator suites, bundled chapter generators | Medium — own creator distribution; bulk is their blind spot |
| Free generators (ScreenApp, TubeAlfred, …) | Paste-URL, free timestamps | Commoditize the raw output — value must live in workflow, never the text |
| Graveyard | VidChapter (discontinued 2026-03) | Validates category mortality; survivors are creator-side SaaS |

## Solo-founder ops honesty

- MTTR when attention is elsewhere: 2–4 days. The hourly canary chop + in-extension status banner exist to buy user patience during that window — they ship before anything else new.
- 24h SLA on any Chrome Web Store policy email; YouChop break-fix preempts all other portfolio projects.
- VA hire at a numeric trigger only: outreach >10 hrs/week AND reply rate >8%.
- Contractor retainer funded from the first pack revenue.

## The corpus brain (gbrain evaluation, 2026-07-25)

*Extraction without retrieval is a pipe, not a product.* `/extract` turns a channel into a
wall of text that a human pastes into an LLM once and then loses. The question was whether
pairing it with gbrain (github.com/garrytan/gbrain, MIT: hybrid vector + keyword + graph
store over markdown, 30+ MCP tools) turns that output into something you can ask questions
of, with citations, forever.

### What the test actually showed

Indexed the real 48-episode Founders corpus (840,544 words) into gbrain with PGLite.

**Ingestion is a clean fit.** 48 pages, 2,116 chunks, 3.8 seconds, zero errors. The
frontmatter + principle + Key lessons + transcript layout our episode files already use is
exactly the shape gbrain wants. No reformatting needed.

**Exact retrieval with citations works.** Searching "idiot index" returned the precise
passage from `009-how-elon-thinks` where the term is defined, plus the semantically adjacent
SpaceX cost-structure passage. "prototypes failure" ranked the Dyson episode first. Real
hits, correctly cited to file.

**Conceptual retrieval was NOT proven, and this is the honest gap.** Asking the actual user
question, "what do these founders say about pricing", returned document headers and
unrelated passages. Weak, and not shippable as-is.

The cause is identified, not mysterious: gbrain's embedding providers are OpenAI,
ZeroEntropy, and Voyage only. **Ollama is a chat provider in gbrain, not an embedding one**,
so there is no free local embedding path. The test therefore ran `--no-embedding`, which
exercises only the keyword (tsvector) leg. Keyword search failing a conceptual question is
the expected result, and it is exactly the gap vector search fills. **The pairing is
plausible but unproven.** Completing the proof costs about $0.02 in embeddings (see
ECONOMICS.md) and needs one key.

### Decision: shape (b), the export. Not hosted.

YouChop ships a **ready-to-run local brain**, not an "ask this channel" web surface.

Why:
- **Marginal cost stays zero.** The buyer supplies their own embedding key, so YouChop adds
  no per-user cost line. This is the only shape that satisfies the free-tiers-first rule in
  ECONOMICS.md without qualification.
- **No hosted vector database**, no per-user storage, no auth surface, no bill that grows
  with success.
- **No new liability.** Hosting a searchable index of someone else's copyrighted catalog is
  a very different legal posture from handing a creator a brain built from their own videos.
  The export keeps us where we already decided to be: private research and synthesis, never
  republication.
- **It matches the promise creators.html already makes**: editable text, yours forever, even
  if you never use YouChop again. A brain folder they own outright is the same promise.
- (c) MCP endpoint is the natural follow-on and costs almost nothing extra once the export
  exists, because the export IS a gbrain brain and gbrain already speaks MCP. Ship (b), get
  (c) nearly free.

Rejected (a) hosted "ask this channel": it needs a database, per-user cost, moderation, and
it puts us in the business of serving other people's catalogs to strangers. That is the one
version of this that could get YouChop sued by the exact creators it wants as customers.

### Positioning

"Turn any channel into a brain you can ask" is the higher-value creator and researcher SKU.
Chapters stay the consumer wedge and the distribution mechanic. Nothing about the extension
or the chapters product changes.

**Gate before selling it:** run the embedded test and confirm conceptual questions
return good cited answers. If they do not, this stays an internal tool and the SKU does not
ship. The evidence above does not yet clear that bar.

### Embedded test, round 2 (2026-07-30). Signal is real. Gate still not passed.

Ran a real vector test with a Voyage key (`voyage-4-lite`, 1024d) over 3 episodes,
transcript body only, deliberately stripping our own Key-lessons summaries so the test
measures retrieval over the source rather than over our synthesis. 143 chunks.

**Vector search clearly beats keyword-only.** Keyword returned zero on-target passages for
conceptual questions. Vector returned genuine hits:
- "pricing and costs" surfaced Jason Fried on paying attention to costs and saving ~$10M by
  leaving the cloud. On target.
- "focus" surfaced the SpaceX "tip of the spear, focus: always identify and attack the
  biggest constraint" passage. On target.
- "hiring and talent" surfaced 37signals treating year two as a rehire decision. On target,
  and the best answer of the run.

**But precision is mediocre and the test is underpowered.** Only 1 to 2 of the top 4 hits per
question were on target; the rest was noise, including a passage about cars in Malibu
returned for "focus". Scores for "focus" topped out at 0.248, which is the retriever telling
us it found little.

Worse, the result set is dominated by one episode. Jason Fried is ~30.8k of the ~47.4k words
in this 3-episode index, about 65%, so he wins nearly every query on chunk volume alone.
Rockefeller returned **zero** hits across all three questions despite being the corpus's
cost-discipline exemplar. A retriever that cannot surface Rockefeller on a costs question is
not yet answering "what do these founders say about X".

**Read this as a floor, not a verdict on gbrain.** Three separate gbrain blockers (a broken
Windows shim, a stale global `embedding_disabled` in `~/.gbrain/config.json` that silently
outranked `--embedding-model`, and token-rate limits) forced the test to bypass gbrain
entirely. So this measures naive cosine similarity over fixed-width 1800-char chunks with no
sentence boundaries, no overlap, no reranking, no keyword fusion, and no query expansion.
gbrain does hybrid RRF plus expansion, which should do materially better. The honest
conclusion is that the *concept* has signal and the *implementation* is untested.

**The decisive test, and what blocks it:** the full 48-episode corpus through gbrain's own
hybrid pipeline. That needs ~1.1M tokens embedded, and Voyage's no-payment-method tier caps
at 3 RPM / 10K TPM, which is roughly two hours of pacing. Adding a payment method lifts the
rate limits while staying inside Voyage's 200M free tokens, so the fix costs nothing but a
billing-page visit. **Until that run happens, the brain SKU stays unsold.**

### Embedded test, round 3 (2026-07-30). Full corpus, local, keyless. Verdict: 1 of 3.

Ran the full 48-episode corpus with **local embeddings** (`bge-small-en-v1.5` via
transformers.js, ONNX on CPU). **No API key, no rate limits, no cost.** 4,911 sentence-aware
chunks with overlap, embedded in 468s for $0.00. Both flaws of round 2 fixed: largest single
episode is now **4.4%** of the index (was 65%), and top-20 hits span **12 to 13 distinct
episodes**, so breadth across founders is real.

Results by question, judged strictly:

- **"pricing and how to charge for a product" — GOOD.** 3 of 5 on target. Ellison on setting
  a per-processor price and issuing a new price list is exactly right; Tony Xu on what
  DoorDash charged restaurants and whether the wage math worked is right; Bezos on not
  charging more when they could is right.
- **"focus and cutting things" — FAILED.** 0 to 1 of 5 on target, and scores compressed into
  0.595-0.602, which is the retriever signalling it found nothing strong.
- **"hiring and building a team" — MIXED.** One clear hit (Brad Jacobs on having the right
  management team and rules of the road that still encourage disagreement), the rest
  tangential.

**The dominant failure mode is corpus hygiene, not retrieval.** Bad hits are consistently
David's podcast-framing chatter: outlining the episode, asking a guest before recording,
requesting a top-10 list. That language is semantically bland, so it matches loosely-worded
queries. It is also removable. This is the single highest-leverage fix available and it costs
nothing: strip host meta-talk from the indexed body, the way we already strip ad reads.

**Where that leaves the SKU: still unsold, but the failure is now diagnosed rather than
mysterious.** Concrete-vocabulary questions work today. Abstract ones ("focus", "cutting")
do not, because the matching vocabulary is diffuse and the meta-chatter outranks it. Three
untried levers, cheapest first: (1) filter host meta-talk from the index, (2) add keyword
fusion and a reranker, which is exactly what gbrain's hybrid RRF pipeline does and which we
have still never actually run, (3) a larger embedding model.

**One clear product win regardless.** Local keyless embeddings work well enough to be the
default. The brain export should ship needing **no API key from the buyer at all**, which
removes the last cost line from the SKU and makes setup "unzip and ask" instead of "go
register for an embedding provider." Update SETUP.md accordingly when the SKU ships.
