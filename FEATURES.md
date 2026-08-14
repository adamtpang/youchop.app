# FEATURES.md, youchop.app

Shelved feature requests: real ideas from real sessions, not built yet. Each entry has
enough context for a future session to pick up cold.

## Local Whisper fallback for videos with zero captions

**Requested:** 2026-08-14, after Phil Jackson's Tetragrammaton episode (`dhPLTSjA9lE`)
turned out to have no captions at all, manual or auto-generated, confirmed independently
via yt-dlp and transcriptapi.com.

**What:** when a video has no captions anywhere, transcribe the audio directly instead of
giving up. `faster-whisper` is already installed locally and proven out this session:

- Ran the `small` model (CPU, int8) on a real 3-minute sample of the Phil Jackson audio.
- ~2.3x realtime (a 170-minute episode would take ~75 minutes to transcribe fully).
- $0 cost, no API key, fully local.
- Quality was genuinely good, real conversational text, not garbled.

**Scope constraint:** this only works in `tools/corpus.mjs --local`, not the hosted
`/api/transcripts` endpoint. Whisper inference is too heavy for a Vercel serverless
function's time/memory budget, the same reason yt-dlp direct-caption pulling only works
locally too (see `api/channel-videos.js`'s keyless approach for the same tradeoff pattern).

**Shape of the fix, if built:**
- New flag on `corpus.mjs`, e.g. `--whisper-fallback`, tried only after yt-dlp's own
  caption pull comes back empty for a video.
- Download audio-only (`yt-dlp -x --audio-format mp3`), transcribe with `faster-whisper`,
  normalize into the same `{t, text}` segment shape the rest of the pipeline expects.
- Model size is a real tradeoff: `small` was the tested one; `tiny`/`base` would be faster
  but less accurate, `medium`/`large` slower but better. Worth benchmarking more than one
  model before picking a default.
- Model load took ~56s the first run (one-time download + cache); negligible after that.

## Extension: detect a channel page, offer to Chop the whole channel

**Requested:** 2026-08-14.

**What:** right now the Chrome extension (`extension/`) only operates on a single video
page, it reads YouTube's own transcript panel via the DOM (see `extension/lib.js`). When
the user is instead browsing a channel page (`youtube.com/@handle`, `/channel/UC.../videos`,
etc.), the extension should detect that context and offer a "Chop this whole channel"
action, rather than requiring the user to leave YouTube and go to `youchop.app/extract`'s
separate "Whole channel" tab to do the equivalent.

**Why this is non-trivial:** the extension's actual free win, reading captions straight out
of YouTube's own rendered DOM, only exists on a single video's watch page (the transcript
panel is watch-page UI). A channel page has no such panel to read from for every video at
once. So "Chop the whole channel" from a channel page necessarily means either:
- (a) the extension calls the SAME hosted pipeline `extract.html` already uses
  (`/api/channel-videos` + `/api/transcripts`), which spends the shared provider quota
  (Apify/Supadata/transcriptapi credits) per video instead of being free, or
- (b) the extension opens each video's watch page in sequence (tabs) and drives the same
  DOM-read path per video, which is free but slow and intrusive (spawns/steals tabs).

**Shape of the fix, if built:**
- Content script or background script detects `location.pathname` matching a channel
  pattern (`/@handle`, `/channel/UC.../videos`, `/c/name`, `/user/name`) and injects a
  "Chop whole channel" button, similar to the existing per-video "Chop" button described in
  `extension/README.md`.
- Clicking it should probably just deep-link to `youchop.app/extract` pre-filled with the
  current channel (reusing the already-built `loadChannelVideos` flow in `extract.html`),
  which is the fast, low-risk version, no new extraction logic in the extension itself.
- A "true in-extension" version (path (b) above) is a bigger lift and duplicates what
  `extract.html` already does well; probably not worth building unless there's a real
  reason someone won't leave YouTube to use the site.
