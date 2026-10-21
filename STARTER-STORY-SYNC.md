# Starter Story corpus reconciliation

## Latest sync and private import, 2026-09-11

Local reconciliation recovered three transcripts: `OV09yPLf8BI`, `xEoLsAQFnOY`, `NFWV9wxRuv4`. Coverage is now **182/183** public Videos-tab uploads. `hCvy-Rt7Naw` remains missing: the local English-caption fetch returned no captions. No access-error stop, paid provider, deployment or recurring automation.

Latest sync: `C:/Users/adamp/ObsidianVault/Notes/Library/StarterStory/sync-2026-09-11/manifest.json`. Canonical private searchable import: `C:/Users/adamp/ObsidianVault/Notes/Library/StarterStory/import-2026-09-11/INDEX.md`. All 182 copied source pages have SHA-256 checks, SQLite integrity passed and search returned source-linked excerpts. Fifteen episodes have full-read synthesis; the other 167 are indexed, not fully analyzed. Excludes Shorts, streams and the paid website library. Summon's `knowledge/STARTER-STORY-KNOWLEDGE-BASE.md` points to this private research.

September 6, 2026. Research tooling only, no deployment.

## Coverage audit, 2026-09-10

Fresh metadata-only reconciliation: **179/183 transcripts available**, four missing. All 179 referenced files exist locally. New private manifest: `C:/Users/adamp/ObsidianVault/Notes/Library/StarterStory/audit-2026-09-10/manifest.json`. No captions fetched, no paid provider, no recurring sync created.

Missing IDs: `OV09yPLf8BI`, `xEoLsAQFnOY`, `NFWV9wxRuv4`, `hCvy-Rt7Naw`. Two new uploads appeared since September 6. The same exclusions apply: public /videos only, no Shorts, streams or paid website library.

## Historical September 6 status

PICKED UP 2026-09-06, by Codex. Latest retry reached **179/181**, then stopped on HTTP 429. Two IDs remain: `NFWV9wxRuv4`, `hCvy-Rt7Naw`.

Resume with `--reuse <latest-private-snapshot>/manifest.json` as well as `--cache <original-corpus>` and a new `--out` directory. The private latest snapshot is `ObsidianVault/Notes/Library/StarterStory/sync-2026-09-06-2010` under Adam's home directory. It references the original cached pages and previous recovered transcript without overwriting them. This run added `BA_fC95p43c`, `5-G9WHwQMwQ`, and locally recovered `AoE1yX9ogCM` after its duplicate English track received HTTP 429. No further network retrieval was attempted after the rate limit.

The reconciler now accepts `--reuse` and requests only `en` on future runs to avoid downloading duplicate English tracks. That single-track adjustment has not yet been exercised live. Four focused tests pass, including reuse of recovered files and rejection of nonexistent paths. No deployment or paid provider was used.

## Earlier checkpoint

The existing `tools/corpus.mjs` defaults to a 20-minute filter. Its latest Starter Story manifest has 16 entries, while the public channel `/videos` listing has 181 uploads. Existing private cached transcript pages cover 175 of those by video ID. A fresh caption fetch recovered one additional transcript before YouTube returned HTTP 429 for another language track. Retrieval stopped. Current reconciled coverage is 176/181, not complete.

`tools/corpus-reconcile.mjs` enumerates all upload durations, reuses `brain/pages` by `video_id`, writes a new private index and downloads missing English captions only when `--sync` is supplied. It never invokes hosted providers or modifies the old corpus. Use a new output directory for each run. `--recover-local PATH` can recover a completed caption file left behind when another language track failed, without network access. Do not retry rate-limited retrieval immediately.

Windows: set `PYTHON` to the actual Python executable with yt-dlp installed, not a WindowsApps alias if Node cannot spawn it.

```powershell
node tools/corpus-reconcile.mjs --cache '<existing-private-corpus>' --out '<new-private-snapshot>' --sync
node --test tools/corpus-reconcile.test.mjs
```

Source: https://www.youtube.com/@StarterStory/videos

Missing video IDs: `BA_fC95p43c`, `5-G9WHwQMwQ`, `AoE1yX9ogCM`, `NFWV9wxRuv4`, `hCvy-Rt7Naw`.

Scope excludes Shorts, streams, other channels and the paid Starter Story website. Caption accuracy is not independently verified. Raw captions and personal comparisons remain private; do not place them in site assets or deploy them. The original filtered manifest is preserved and must not be mistaken for the all-duration snapshot. No recurring sync was scheduled and no paid provider fallback is authorized.

Focused checks: three unit tests pass for ID-based identity, inclusion of short uploads/deduplication and caption cleanup. Live reconciliation returned 181 listed, 176 available, one newly fetched, five missing, rate-limit stop recorded.
