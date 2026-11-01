# YouChop extension (v0.14.0, unpublished)

The **Chop** transcript button appears on video pages regardless of whether they
already have chapters. It uses a visible action row and relocates when YouTube
replaces that row. Shorts, embeds, fullscreen, and layouts without an action row
get a floating Chop button. `/live/VIDEO_ID` links are recognized too.

## Deep transcribe (YouTube)

Single-video Chop opens in **Timestamps** when timing is available. Untimed text
stays in Clean text; the timestamp formats become available after recovery.
**Deep transcribe** in the modal downloads the video's audio and runs local Whisper
when captions are absent, untimed or possibly incomplete. It is also available
manually for errors the timing checks cannot detect. Long gaps and early endings
are warnings, not proof of missing speech.

Start `npm run transcribe` in this repository, then reload the unpacked extension
in Helium's extensions page. Version 0.14.0 adds loopback host access. Click **Deep
transcribe** to start; progress and the timestamped result appear in the same modal.
Closing the modal leaves the local job running. Reopen Chop and click Deep
transcribe again to reconnect, including after completion (until the service
restarts). The previous text stays available while processing or after an error.

Audio stays local, with no paid speech API or browser-cookie export. A missing
Whisper model downloads once. Three-minute audio chunks bound decoding memory;
review machine wording, especially names and chunk boundaries. Long videos can
process slower than real time. Downloads are limited to 150 MB; unavailable,
sign-in-gated, rate-limited and active-live videos can fail. The separate local
transcriber also accepts uploaded audio/video. Completed text enters the existing
private browser cache; original audio and outputs remain in ignored `exports/`.

Verification: 35 Node tests and 7 Python tests; isolated Helium modal fixtures
cover recovery, progress, missing timing, offline errors and 390px layout. A real
85-second local audio job produced 305 words and 18 timestamped segments. The
extension-to-loopback bridge is regression-tested; an installed-extension browser
end-to-end download/transcription was not performed. Everyday Helium was not reloaded.

## Instagram transcripts

On an Instagram Reel or video post, the popup offers **Open Instagram transcriber**.
Start `npm run transcribe` in this repository first. The button opens the loopback
tool with the tracking parameters removed, then you press **Transcribe locally**.
Audio is obtained with yt-dlp and transcribed on this computer with Whisper. No
speech-service upload or paid API. Local audio/video file input is also supported.
See [INSTAGRAM-TRANSCRIPTS.md](../INSTAGRAM-TRANSCRIPTS.md) for setup and limitations.

### Chop profile (v0.15.0)

On an Instagram profile (`/username/` or `/username/reels/`), a **Chop profile** button
appears (also in the popup). **Find posts** scrolls the grid and collects post links,
up to a limit (default 100, max 300). It only reads links: no likes, follows or
messages. Signed out, Instagram shows only about 12 posts per tab, so sign in for the
full grid. **Transcribe** sends each post URL, one at a time, through the background
bridge to the local transcriber (`npm run transcribe`), which downloads the audio
anonymously; your Instagram cookies never leave the browser. Photo posts and private
posts are listed as failed; music-only reels as no speech. The result is one Markdown
file with an index, captions, dates and timestamped transcripts. Rerunning while the
local transcriber stays open reuses finished posts.

## Channel queues

Open a YouTube channel and click **Build channel queue** (also available from the extension popup). Choose **Latest**, **Most popular**, or **Oldest**, request **1–50 videos**, and optionally filter by minimum/maximum duration in minutes and text in the title. The builder follows YouTube’s native sort order and fetches additional pages until enough matching videos are found, the channel ends, or the 2,000-video / 70-page scan limit is reached. An incomplete scan is labeled; duration filters exclude videos whose duration is unavailable.

Preview and remove individual videos, then **Watch queue**, **Chop transcripts**, or **Download links**. Watch opens a temporary YouTube playlist, not a playlist saved to your YouTube account. The latest queue and its settings are saved locally in this browser and restored when you reopen the builder on the same channel. Building another channel’s queue replaces this local saved queue. Download links to keep multiple queues.

The listing reads public metadata from the channel’s Videos tab through YouTube in your browser. It does not use hosted transcript providers. Transcript extraction reuses the existing local playlist path, with one Markdown document per video. Closing the panel stops requesting subsequent listing pages or cancels its transcript job; an already-running listing request may finish.

Verified in Helium on Starter Story: all three sort orders, duration/title filters, saved restoration, a three-video temporary watching playlist, and one queued transcript (22,801 Markdown characters). `npm test` passes 30 tests.

## Loader reliability (v0.11.1)

Failed native transcript requests are reused within the current Chop instead of being sent twice. Loader waits use elapsed time, and the service worker stops waiting for a MAIN-world response after 12 seconds. This bounds that request, not the whole extraction. Transcript chip selection uses the actual button and respects its selected state.

Verified in Helium: 574 lines / 22,007 characters on `Z9iksIAXcbk`, then successful browser-cache reuse and visible panel output. `npm test` passes 26 tests.

One-click transcript extraction on any YouTube video or public playlist. The
extension injects **Chop** and **Chop playlist** into YouTube's action rows. Results
can be copied or downloaded as clean text, timestamps, or Markdown with deep links.

## Load it locally

1. `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** and pick this folder

## How it gets the transcript

`lib.js` tries four sources in order:

1. **YouTube's own transcript panel, confirmed working in Chromium browsers.**
   Free, local, nothing leaves the machine. The extension opens the panel itself, then reads
   the rendered DOM. This is reliable precisely because YouTube fetched the data with its own
   valid tokens; we only read what it drew.
2. **YouTube's own native transcript continuation loader.** If the panel expands but remains
   stuck on its loading spinner, the extension invokes the continuation component's own
   MAIN-world method. This matters because YouTube now adds private request preconditions that
   a reconstructed `get_transcript` POST can miss. This path is free and local and does not use
   YouChop provider credits. A manual request remains only as a compatibility fallback.
3. The caption endpoint directly. **Currently bot-gated:** `baseUrl` returns HTTP 200 with an
   *empty body* (no `pot` param, so PoToken blocks it). Kept as a cheap second try in case
   that changes.
4. `youchop.app/api/transcripts`. Spends the server's provider quota, so it
   is the last resort rather than the default.

In practice path 1 handles it, so **local extraction is free per use**.

### Transcript reuse cache

Every successful extension extraction is saved in `chrome.storage.local` by video id
and language for up to 90 days. The cache is bounded to 80 transcripts and roughly
7 MB, evicting expired and oldest entries first. A repeat **Chop** returns the saved
segments before opening YouTube's transcript panel. Playlist jobs check the same cache
before opening an inactive temporary tab, so already-chopped videos are reused too.

The hosted transcript API separately stores successful provider-fetched public
transcripts in Vercel Runtime Cache for 30 days. Timestamped rows are the canonical
entry, so clean text and timestamp requests reuse one provider result. Failures are
never cached. Browser-local transcript text, including private playlist material, is
never promoted into the cross-user shared cache.

### Playlists

On a playlist page, or a watch page with a `list=` parameter, click **Chop playlist**.
The extension lists the rendered playlist rows from the signed-in YouTube page, then
opens one inactive temporary YouTube tab at a time and runs the same local extractor.
It pauses and mutes playback, tracks every tab by job, and closes only the tabs it
created. Closing the YouChop panel immediately cancels the job and retries cleanup
of its current tab. A run is capped at 50 videos and never uses a hosted transcript
provider as a playlist fallback. Results are presented as one standalone file per
video in a transcript-file picker. Each Markdown file has its own frontmatter,
source link, timestamp deep links, and playlist position; Copy and Download act on
the selected file instead of merging the playlist into one document.

Private and unlisted playlists are listed from the authenticated YouTube page DOM
instead of the anonymous server endpoint. Public playlists use the same local path
when their rows are already rendered, with `/api/playlist-videos` retained as the
fallback. The playlist button is injected only into a visible header action row;
zero-sized legacy headers left behind by YouTube's SPA are ignored.

### Chapters for comments or descriptions

After a video transcript is extracted, **Make chapters** sends those already-extracted
timestamp rows to `youchop.app/api/chapterize`. The API no longer fetches the transcript
again, so this path does not spend TranscriptAPI credits. The server may send the text
to Anthropic when its chapter engine is enabled. The attributed output is shown in an
editable field and is copied only after another explicit click. YouChop never posts to
YouTube and grants no reward for copying, pasting, or commenting. The chapterize button
is shown only when the current video has no creator or automatic YouTube chapters. Long
videos have no arbitrary chapter-count ceiling, and the server refuses a visibly incomplete local transcript
instead of returning a partial chapter list. The optional attributed block ends with
`⏱ Chapters by https://youchop.app`.

### Failure diagnostics

When every source fails, the result panel now includes a chronological `debug trace`.
It records the loaded library and manifest versions, panel state, every wait and chip
selection, continuation metadata presence, HTTP statuses, response byte counts, parser
candidate counts, and the final DOM snapshot. The trace deliberately omits API keys,
cookies, visitor data, continuation values, response bodies, and transcript text.

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

No analytics and no YouChop account. Transcript paths 1 through 3 stay on YouTube and
successful results may be retained on the user's device for up to 90 days. Path 4 sends
the 11-character video id and requested language to youchop.app, where successful public
provider results may be retained in the regional runtime cache for up to 30 days. Playlist
listing sends the public playlist id. Chapter generation sends the extracted timestamp
rows and basic public video metadata to youchop.app and, when enabled, Anthropic.
