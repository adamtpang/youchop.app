# YouChop extension (v0.1.0, unpublished)

One-click transcript extraction on any YouTube video. Injects a **Chop** button into
YouTube's action row; the result panel offers clean text, timestamps, or markdown with
deep links, plus copy and download.

## Load it locally

1. `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** and pick this folder

## Status: extraction path is PARTIALLY VERIFIED. Read this before trusting it.

Tested against a live YouTube page in an automated browser on 2026-07-31.

| Path | Result |
|---|---|
| Parse `ytInitialPlayerResponse` from the watch page (title, author, caption list) | **Works.** The brace-walking parser is correct. |
| Fetch the caption `baseUrl` directly | **Blocked.** Returns HTTP 200 with an *empty body*, with `fmt=json3` and without. The URL carries no `pot` param, so YouTube's PoToken bot-check is serving nothing. |
| Innertube `get_transcript` | **400.** The payload needs more `context` fields than we send. |
| Read YouTube's own rendered transcript panel | **Unproven.** The button is findable and the panel exists in the DOM, but a programmatic `.click()` left it `ENGAGEMENT_PANEL_VISIBILITY_HIDDEN` and no segments rendered. |

Important caveat: that testing ran in an **automated browser with no logged-in YouTube
session**. A real user's Chrome has different cookies, a real fingerprint, and genuine user
gestures, all of which plausibly change the PoToken and panel-click outcomes. So the local
paths are *unconfirmed*, not *known broken*.

Because of that uncertainty `lib.js` tries three sources in order, and the last one works today:

1. **YouTube's open transcript panel** (free, local, most reliable when the user has it open,
   since YouTube fetched the data itself with valid tokens)
2. **The caption endpoint directly** (free, currently bot-gated)
3. **`youchop.app/api/transcripts`** (proven, this is what built the 1.28M-word corpora;
   uses the server's provider quota)

So the button returns a transcript today via path 3 even if 1 and 2 fail.

## Next step to make it fully free

Verify path 1 in a real Chrome profile: open a video, click **Show transcript** yourself, then
click **Chop**. If `fromPanel()` returns rows, the extension is fully local and costs nothing
per use, and the button can simply open the panel first. That single manual check is the
cheapest way to settle it.

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
