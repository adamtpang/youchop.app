# Claude Code prompt: turn YouChop from a transcript pipe into a queryable brain

Paste below the line into a Claude Code session opened IN the youchop.app repo.

---

You are upgrading **YouChop** by absorbing **gbrain** (github.com/garrytan/gbrain, MIT):
a hybrid vector + keyword + knowledge-graph store over git-backed markdown, exposed as
30+ MCP tools.

## The insight
YouChop's `extract.html` + `api/` already do the hard half: any YouTube channel becomes a
full transcript corpus (it built Adam's 48-episode, ~810k-word Founders corpus). But the
output is a wall of text a human pastes into an LLM and then loses. **Extraction without
retrieval is a pipe, not a product.** gbrain is the missing half: the same corpus becomes
something you can ask questions of, with citations, forever.

New positioning to evaluate: **"Turn any channel into a brain you can ask."** Chapters
stay the consumer wedge; the corpus brain is the higher-value creator and researcher SKU.

## Do this

1. **Prove the pairing on a real corpus before writing any product code.** Take an existing
   YouChop extraction (the Founders set in `../summon.company/knowledge/` is the best
   proof), index it with gbrain locally (`bun install -g github:garrytan/gbrain`,
   `gbrain init --pglite`), and run three questions a real user would ask, for example
   "what do these founders say about pricing" or "who talked about focus and what did they
   do". Paste the answers with citations. If the answers are weak, stop and report that:
   the whole upgrade rests on this being good.

2. **Decide the product shape from the evidence.** Options: (a) a hosted "ask this channel"
   surface on youchop.app, (b) an export that hands the user a ready-to-run local brain,
   (c) MCP endpoint so the user's own agent can query their channel corpus. Pick ONE and
   write why in `STRATEGY.md`. Bias to (b) or (c): they need no hosted database, no
   per-user cost, and no scraping-liability surface.

3. **Price it against the existing ladder.** `creators.html` sells a $99 back-catalog pack
   and a $12/mo continuity sub. Propose where the brain SKU sits and update `ECONOMICS.md`
   with the real marginal cost (embedding + storage) so the margin is honest.

4. **Respect the constraints that already exist.** Read `ECONOMICS.md`, `GROWTH.md`,
   `STRATEGY.md` first. Transcript sourcing already runs on free tiers (YouTube Data API,
   Apify) with a paid fallback; do not add a cost line that breaks that model.

5. **Ship the smallest real thing.** No rewrite. The landing stays static, the API stays
   three Vercel functions. If the chosen shape is an export or MCP, that is a small addition
   to the existing extract flow, not a new app.

## Constraints
- Keys stay in env, free tiers first, mock mode must still work with no keys.
- Do not break the Chrome extension or the existing chapters product.
- No em dashes. Match the repo's plain style.

## Definition of done
Three real cited answers from a YouChop-built corpus as evidence, one chosen product shape
written into STRATEGY.md with the reason, a priced SKU in ECONOMICS.md with honest margin,
and the smallest implementation shipped or explicitly scoped as the next task.
