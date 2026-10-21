# YouChop productization test

Date: 2026-09-10. Run using `C:/Users/adamp/.codex/skills/productize/SKILL.md`.
Disposition: offer draft and local capability verification complete; customer validation pending.

## Sellable product

For creators and editors with long-form videos that lack chapters, YouChop delivers reviewed, editable timestamp-and-title lists ready to paste into their video descriptions, from eligible video URLs and available timed transcripts.

The customer buys completed chapter files and saved editing work. The extension, extraction pipeline, and AI are delivery machinery. Transcript/corpus exports are a separate capability, not another promise bundled into this test.

Classification: `customer_product`, confirmed in `../summon.company/company/AETHER_REPOSITORY_CLASSIFICATIONS.json`. This does not require forming another company.

## Facts and limits

| Evidence | Meaning |
| --- | --- |
| OFFER.md says $99 for up to 200 videos; creators.html displays $49 | Price conflict; neither was changed. Checkout amount was not verified. |
| creators.html sets STRIPE_PACK_URL to a payment link | Source has a payment route; older STATUS.md says it is unwired. No successful payment is established. |
| API returns 409 for existing creator or automatic chapters | Target unchaptered videos. The previous idea of comparing regenerated output on already-chaptered videos conflicts with current behavior. |
| API accepts browser-local timed rows; incomplete transcripts are rejected | A local delivery path exists with meaningful eligibility guards. |
| September 6 handoff records real extraction in 7.7 seconds and cache reuse in 17ms | Historical extraction proof, not proof of reviewed chapter quality or a 200-video delivery. |
| EVIDENCE.md includes mock generation in activation definition | This assessment excludes mock, synthetic, and internal runs from external customer activation. No metric code changed. |
| Historical revenue baseline is zero; no newer paid receipt inspected | Current paid demand remains unverified, not asserted to be zero today. |

STATUS.md also predates the restored extension. Prefer dated implementation receipts over its old missing-source claim. The July economics estimates exclude important delivery labor and are not verified current margins.

## Draft delivery contract

- First proof: three eligible videos from one consenting creator; retain the existing free sample concept. No promised full-catalog delivery until capacity is measured.
- Inputs: URLs, usable timed captions or supplied timed transcripts, language and naming preferences, and confirmation the creator can edit the descriptions.
- Output: one text or Markdown file per video, source URL, ascending timestamps and descriptive titles, plus an exceptions list. Creator pastes the result; no automatic channel edits.
- Acceptance: start at 0:00; at least three chapters, each at least 10 seconds; labels correspond to actual topics; review beginning, middle, and ending against the video; exclude missing/incomplete captions and already-chaptered videos with explicit reasons. Short or unsuitable videos are ineligible.
- Full-video coverage means useful topics across the duration, not a chapter arbitrarily inserted at the last second.
- Draft sample service target: within the existing page's 48-hour sample window, subject to measured capacity. Review one round of factual/timestamp corrections. These are draft terms, not new public commitments.
- No guarantee of search inclusion, better retention, traffic, or revenue. Google/YouTube control discovery and chapter display.

## Economics: measure before scaling

At 200 videos, $49 is $0.245/video and $99 is $0.495/video. Neither price is approved by this assessment.

Illustrative labor sensitivity at $20/hour, excluding all other costs:

| Review time per video | Labor for 200 videos | Remaining at $49 | Remaining at $99 |
| --- | --- | --- | --- |
| 30 seconds | $33.33 | $15.67 | $65.67 |
| 2 minutes | $133.33 | -$84.33 | -$34.33 |

These are assumptions, not measured costs or margins. Subtract generation, extraction, retries, payment fees, support, acquisition and infrastructure next. Record total creator time too: 200 manual description edits could erase much of the benefit. Keep a useful free sample; use measured delivery cost and customer value to choose sustainable pack limits and prices.

## One binding constraint and demand test

Binding constraint: no inspected external receipt proving a creator uses and values the output. The conflicting price must be resolved before a paid offer is presented, but more product surfaces do not resolve this evidence gap.

Suggested audience: an editor or creator actively publishing tutorials, interviews, or educational videos with an unchaptered back catalog. Their publishing workflow is the demand occasion. Subscriber count alone does not qualify a buyer.

Bounded experiment proposal: at most five qualified creators, three sample videos each, at most two hours of preparation before reassessment, no paid traffic or new provider spending. Adam handles every person-to-person message. Before outreach, reconcile the price shown in the offer, landing page and checkout.

Record qualified creators shown the offer, samples accepted, videos eligible/completed/failed, review and correction minutes, creator editing minutes, actual description pastes, paid-pack requests, payments, refunds, and repeat orders. Keep each numerator with its denominator.

Continue to a single bounded paid delivery if at least one external creator uses a sample and purchases the reconciled offer. Sample use without purchase supports usefulness only. If samples require more manual work than they save, revise delivery. If none of five qualified creators uses a sample, revise the problem/offer before expanding features. These are practical small-sample decisions, not statistical proof of demand or grounds to dismiss the whole market.

## Verification performed

- Read AGENTS.md, current CLAUDE.md, NORTH_STAR.md, OFFER.md, EVIDENCE.md, STATUS.md, ECONOMICS.md, organization and classification records; compared creator-page pricing/payment configuration with API behavior.
- Ran `npm test` on September 10: 26 passed, zero failed. Includes browser-row reuse, existing-chapter refusal, incomplete-transcript rejection, duration coverage, cache reuse, and worker timeout behavior. Tests use controlled fixtures; they do not prove production health or customer value.
- No runtime code, checkout, prices, private corpora, deployments, or external communications changed. No new real-video or paid-provider run performed.
- Relevant external reference checked in the preceding research: [YouTube chapter rules and automatic chapters](https://support.google.com/youtube/answer/9884579?hl=en). YouTube says not all eligible videos receive automatic chapters; this is a plausible target segment, not evidence of purchases.

Next human action: resolve $49 versus $99 against the intended offer and checkout, then provide one owned/permitted unchaptered video or introduce a willing creator manually. The three-video sample remains an unrun customer experiment.
