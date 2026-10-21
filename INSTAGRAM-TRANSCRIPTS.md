# Free local YouTube and Instagram transcripts

Run `npm run transcribe` in this folder and open **http://127.0.0.1:8876**. Paste a
public YouTube video or Reel/video-post link or choose a local audio/video file, then press
**Transcribe locally**. Copy the editable result or download TXT, Markdown or SRT.
The extension popup on an Instagram video post opens this same tool with a clean
URL. The service must be running; it is a separate local process.

The provided Reel `https://www.instagram.com/reel/DeKieZFiL7e/` downloaded without
authentication on October 12, 2026. Example output is private under
`exports/instagram-DeKieZFiL7e-2026-10-12/`.

## How it works

yt-dlp obtains the media, then faster-whisper transcribes on the CPU. No paid API,
speech-service upload, automatic clipboard copy, or browser-cookie access. A
missing model downloads once. `small` is the default; `medium` is slower and
usually more accurate. Machine transcripts need review, especially names and
numbers. Instagram changes can break link retrieval. Login-gated/unavailable
posts fail with a useful error; local files use the same transcription path.
Photo-only posts have no spoken transcript. Multi-video carousels are rejected;
upload an individual video instead. Media is limited to 150 MB.

This wiring is built on established tools rather than importing another app's
full stack. Existing free alternatives include
[Instagram Transcriber](https://github.com/yusosadick/instagram-transcriber),
[yt-dlp](https://github.com/yt-dlp/yt-dlp), and
[faster-whisper](https://github.com/SYSTRAN/faster-whisper).

## Setup and command line

If needed: `python -m pip install -r tools/transcribe-requirements.txt`, plus
FFmpeg on PATH. Set `YOUCHOP_PYTHON` to the executable that has these dependencies
if the launcher cannot find it. Python 3.11 or newer is recommended.

```
python tools/local_transcribe.py "https://www.instagram.com/reel/DeKieZFiL7e/" --out exports/my-reel
python tools/local_transcribe.py "C:/path/to/video.mp4" --model medium --out exports/my-video
```

The server binds only to 127.0.0.1, accepts local-page and extension-origin requests with a session
token, limits queue size, and never serves arbitrary local paths. Output stays
under `exports/local-transcripts/`, excluded from Git and Vercel. Press Ctrl+C in
the service terminal to stop it. Do not deploy this local server to Vercel.

YouTube's **Deep transcribe** modal button uses this service directly. It reports
progress, reconnects to an existing job for the same URL/model, and renders the
result with timestamps. API protocol 2 detects an older running service and asks
for a restart. Only individual HTTPS YouTube/Instagram URLs are accepted. Active
live streams are rejected; local files remain supported. No downloader cookies
are supplied. Full audio is processed in bounded three-minute windows, and no
complete result is saved if a window fails. Timing checks do not certify accuracy.
