# YouChop: Summon status

<!--
summon-status-version: 1
canonical-template: summon.company/templates/STATUS.md
update-rule: Change claims only when dated evidence changes.
-->

**As of:** 2026-08-29  
**Repository:** `youchop.app`  
**Public surface:** https://youchop.app  
**Lifecycle:** Live self-serve activation, pre-customer  
**Overall status:** One-video chapterization works end to end on real captions, but no external activation, description paste, or paid creator pack is recorded.

## Perfect version

YouChop lets a creator paste one video or channel, receive useful, editable, search-phrased chapters, update an entire back catalog with little effort, and keep every result while YouChop earns from a clearly bounded pack or continuity service.

### Company outcome

- **Buyer or user:** YouTube creators, editors, and small agencies with long-form tutorial, education, podcast, or interview back catalogs.
- **Painful problem:** Hundreds of long videos lack usable topic chapters, forcing viewers to scrub and hiding topics from search Key Moments.
- **Transformation:** A transcript becomes paste-ready chapters in seconds for one video and a completed back catalog for the paid pack.
- **Proof that would make this undeniable:** A qualified external creator pastes a generated result into a real description and then pays for the $99 back-catalog pack.

## Current truth

The `/chop` self-serve path and `/api/chapterize` are live. A production E2E run returned eight chapters for a real 3Blue1Brown video using Supadata and the heuristic engine. The channel-search path is blocked by a missing YouTube Data key, the Anthropic key was invalid at the recorded check, the original extension source was lost, and the $99 pack still uses manual fulfillment rather than a wired Stripe link.

### Verified evidence

- `POST /api/transcripts` returned 200 through Supadata on a real video.
- `POST /api/chapterize` passed on `aircAruvnKk` with eight chapters and a paste block starting at 0:00.
- `First Chapterize` is defined as a successful chapter response with at least one chapter and paste block.
- Revenue, MRR, active paying creator channels, and weekly active extension usage were all 0 at the recorded baseline.
- The extension was never Chrome Web Store published and its original source is missing.

### Revenue chain

Revenue requires all three links to be true at once.

| Link | Status | Evidence |
| --- | --- | --- |
| Offer: real, priced, payable | PARTIAL | Free one-video, $99 pack, and $12 monthly continuity are defined; pack checkout is not wired. |
| Reach: shown to a real stranger | MISSING | No external First Chapterize or creator sample delivery is logged. |
| Convert: a real stranger paid | MISSING | Revenue, MRR, and paying creator channels are 0. |

## One binding constraint

**Obtain one external First Chapterize that becomes a real description paste and then test the $99 pack ask.**

The free proof unit already works. More extension or channel tooling should not outrank evidence that a creator uses the output and wants the bulk outcome.

## Summon company gates

| # | Gate | Status | Project-specific evidence or gap |
| ---: | --- | --- | --- |
| 1 | Outcome | PASS | The creator, problem, chapter output, and pack are explicit. |
| 2 | Evidence | PARTIAL | Real production chapterization works; external creator value is unverified. |
| 3 | Workspace | PASS | Static site, APIs, corpus tool, offer, and operating documents exist. |
| 4 | Organization | PARTIAL | Relationships are declared, but no active accountable company formation is evidenced. |
| 5 | Skills | PASS | Transcript extraction and chapter generation work on real captions. |
| 6 | Runtime | PARTIAL | `/chop` works; channel search, LLM titles, checkout, and extension remain incomplete. |
| 7 | Governance | PASS | Manual fulfillment and no-false-extension boundaries are documented. |
| 8 | Critical path | PASS | URL, chapters, paste, pack ask, and fulfillment form a clear path. |
| 9 | Execution | PARTIAL | One-video execution works; paid bulk delivery has no receipt. |
| 10 | Verification | PARTIAL | Internal E2E evidence exists; external activation and revenue do not. |

Status vocabulary: `PASS` is backed by evidence, `PARTIAL` has a real beginning but a named gap, `MISSING` has no verified implementation, and `HELD` awaits an explicit board decision or external input.

## Personalized roadmap

### Now

1. Dogfood `/chop` on one of Adam’s own uploaded long-form videos.
2. Paste the result into the real YouTube description manually and record the exact before and after.
3. Confirm whether the chapters save time and improve navigation before changing the engine.

### Next

1. Select one qualified creator with a substantial unchaptered back catalog.
2. Prepare one free sample from a real video; Adam handles delivery and conversation manually.
3. Record whether the creator pastes it and whether they accept or reject the $99 pack.

### Later, only after evidence unlocks it

1. Wire a payment rail only after the manual pack offer receives buying intent.
2. Restore channel listing and bulk fulfillment only when one pack requires them.
3. Rebuild or publish the viewer extension only if creator traction proves it is a useful distribution wedge.

## Core 8 focus

| Department | Current responsibility |
| --- | --- |
| Engineering | Protect the working transcript-to-chapter path and remove only proven delivery blockers. |
| Design | Make editing and copying chapters effortless. |
| Marketing | Demonstrate real before-and-after video descriptions. |
| Sales | Test the free sample to $99 pack sequence; Adam sends every message. |
| Finance | Track pack revenue, continuity MRR, provider cost, and fulfillment time. |
| Operations | Own First Chapterize, paste receipt, and bulk-delivery evidence. |
| Support | Capture poor timestamps, captions, titles, and creator edits. |
| Legal | Respect YouTube, transcript-provider, creator-content, and communication permissions. |

## Board gates

Adam must authorize every creator contact, sample delivery, checkout change, provider key or paid plan, extension publication, and production deployment. Generated chapters are drafts until the creator or Adam applies them manually.

External messages, publication, deployment, spending, contracts, payment changes, refunds, destructive actions, and new commitments remain human-authorized. Drafts and reversible internal work do not imply permission to perform the external action.

## Sources of truth

- `repos.yaml`
- `NORTH_STAR.md`
- `EVIDENCE.md`
- `OFFER.md`
- `README.md`
- `CLAUDE.md`
- `STRATEGY.md`

## Update contract

- Keep exactly one binding constraint.
- Record facts, dates, receipts, and test results. Do not turn activity into evidence.
- Self-use proves personal utility, not market demand. Label both honestly.
- A draft is not reach. A checkout visit is not conversion. A self-payment is not stranger revenue.
- Change the roadmap when evidence changes, not because another feature sounds exciting.
- Preserve this company’s specific buyer, workflow, risks, and personality. The template is shared; the company is not generic.

