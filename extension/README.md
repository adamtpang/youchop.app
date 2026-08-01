# YouChop extension (v0.1.0, unpublished)

One-click transcript extraction on any YouTube video. Injects a **Chop** button into
YouTube's action row; the result panel offers clean text, timestamps, or markdown with
deep links, plus copy and download.

## Load it locally

1. `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** and pick this folder

## How it gets the transcript

`lib.js` tries three sources in order:

1. **YouTube's own transcript panel — CONFIRMED WORKING in real Chrome (2026-08-01).**
   Free, local, nothing leaves the machine. The extension opens the panel itself, then reads
   the rendered DOM. This is reliable precisely because YouTube fetched the data with its own
   valid tokens; we only read what it drew.
2. The caption endpoint directly. **Currently bot-gated:** `baseUrl` returns HTTP 200 with an
   *empty body* (no `pot` param, so PoToken blocks it). Kept as a cheap second try in case
   that changes.
3. `youchop.app/api/transcripts`. Always works, but spends the server's provider quota, so it
   is the last resort rather than the default.

In practice path 1 handles it, so **extraction is free per use**.

### Long videos: the virtualised-list problem

YouTube only keeps the *visible* transcript rows in the DOM, so a naive read of a two-hour
video returns a fraction of it. `harvestPanel()` scrolls the panel and accumulates rows,
deduping by timestamp, until the last timestamp reaches the video's duration or nothing new
arrives. Progress is measured as **last-loaded-timestamp / video-duration**, which is why the
bar and the ETA reflect real work instead of being decorative.

## Files

    manifest.json   MV3, youtube.com only, minimal permissions
    lib.js          extraction and formatting (shared)
    content.js      injects the button, renders the panel, handles SPA navigation
    content.css     scoped styles
    popup.html/js   toolbar-icon route to the same action

No icon is bundled, so Chrome shows a default placeholder. Add `icon128.png` and an `icons`
key to `manifest.json` before publishing.

## Privacy

Runs entirely in the tab. No analytics, no account. Paths 1 and 2 send nothing anywhere;
path 3 sends only the 11-character video id to youchop.app.
