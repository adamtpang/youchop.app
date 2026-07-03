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
