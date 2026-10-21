"""Free local YouTube/Instagram/file transcription. No hosted speech API or cookies.

python tools/local_transcribe.py VIDEO_URL_OR_FILE --out exports/my-transcript
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import shutil
import math
import tempfile
from urllib.parse import urlsplit, parse_qs

MODELS = ("tiny", "base", "small", "medium")
MEDIA_TYPES = {".mp3", ".mp4", ".m4a", ".wav", ".webm", ".mov", ".ogg", ".flac", ".aac"}
MAX_BYTES = 150 * 1024 * 1024
_models = {}


def normalize_instagram_url(value):
    parsed = urlsplit(str(value).strip())
    if (parsed.scheme != "https" or parsed.hostname not in {"instagram.com", "www.instagram.com"}
            or parsed.username or parsed.password or parsed.port not in {None, 443}):
        raise ValueError("Use a direct https://www.instagram.com/reel/ or /p/ video link.")
    match = re.fullmatch(r"/(reel|p|tv)/([A-Za-z0-9_-]{5,64})/?", parsed.path)
    if not match:
        raise ValueError("Use an individual Instagram Reel or video post, not a profile or Story.")
    return f"https://www.instagram.com/{match[1]}/{match[2]}/"


def normalize_media_url(value):
    parsed = urlsplit(str(value).strip())
    if parsed.hostname in {"instagram.com", "www.instagram.com"}:
        return normalize_instagram_url(value)
    if (parsed.scheme != "https" or parsed.hostname not in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
            or parsed.username or parsed.password or parsed.port not in {None, 443}):
        raise ValueError("Use a direct HTTPS YouTube video or Instagram Reel link.")
    if parsed.hostname == "youtu.be":
        video_id = parsed.path.strip("/")
    elif parsed.path == "/watch":
        video_id = parse_qs(parsed.query).get("v", [""])[0]
    else:
        match = re.fullmatch(r"/(?:shorts|live|embed)/([A-Za-z0-9_-]{11})/?", parsed.path)
        video_id = match[1] if match else ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise ValueError("Use an individual YouTube video, not a channel or playlist.")
    return f"https://www.youtube.com/watch?v={video_id}"


def clock(seconds, srt=False):
    millis = round(max(0, float(seconds)) * 1000)
    hours, rem = divmod(millis, 3600000)
    minutes, rem = divmod(rem, 60000)
    secs, ms = divmod(rem, 1000)
    if srt:
        return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"
    return f"{hours}:{minutes:02}:{secs:02}" if hours else f"{minutes}:{secs:02}"


def render_outputs(result):
    rows = result["segments"]
    text = "\n".join(row["text"] for row in rows)
    source = f"Source: {result['source']}\n\n" if result.get("source") else ""
    markdown = (f"# {result['title']}\n\n{source}"
                "Local machine transcription. Review names, numbers and wording against the audio.\n\n"
                + "\n\n".join(f"[{clock(r['start'])}] {r['text']}" for r in rows) + "\n")
    srt = "\n\n".join(f"{i}\n{clock(r['start'], True)} --> {clock(r['end'], True)}\n{r['text']}"
                        for i, r in enumerate(rows, 1)) + "\n"
    return {"transcript.txt": text + "\n", "transcript.md": markdown, "transcript.srt": srt,
            "transcript.json": json.dumps(result, ensure_ascii=False, indent=2) + "\n"}


def download_instagram(value, directory, progress=lambda message: None):
    return download_media(normalize_instagram_url(value), directory, progress)


def download_media(value, directory, progress=lambda message: None):
    url = normalize_media_url(value)
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    progress("Downloading audio...")
    command = [sys.executable, "-m", "yt_dlp", "--no-playlist", "--retries", "0", "--fragment-retries", "0",
               "--match-filter", "!is_live & !is_upcoming",
               "--socket-timeout", "20", "--no-progress", "--max-filesize", str(MAX_BYTES),
               "--no-simulate", "--print", "after_move:YOUCHOP_MEDIA:%(filepath)s",
               "-f", "bestaudio/best", "--write-info-json", "-o", str(directory / "%(id)s.%(ext)s"), url]
    options = {"capture_output": True, "text": True, "encoding": "utf-8", "errors": "replace", "timeout": 600}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NO_WINDOW
    process = subprocess.run(command, **options)
    if process.returncode:
        message = re.sub(r"https?://\S+", "[URL]", process.stderr[-1000:])
        raise RuntimeError("The site couldn't provide this video. It may require sign-in, be unavailable, "
                           "or be rate-limited. You can transcribe a local video/audio file instead. " + message)
    files = [Path(line.removeprefix("YOUCHOP_MEDIA:")).resolve() for line in process.stdout.splitlines()
             if line.startswith("YOUCHOP_MEDIA:")]
    if not files:
        raise RuntimeError("The post has no downloadable audio/video. Photo-only posts have no spoken transcript.")
    if len(files) != 1:
        raise ValueError("This post contains multiple videos. Use an individual Reel or upload one video file.")
    media = files[0]
    if directory.resolve() not in media.parents or media.suffix.lower() not in MEDIA_TYPES:
        raise RuntimeError("The downloader returned an unexpected media path.")
    if media.stat().st_size > MAX_BYTES:
        raise ValueError("Media must be at most 150 MB.")
    metadata_file = media.with_suffix(".info.json")
    metadata = json.loads(metadata_file.read_text("utf-8")) if metadata_file.exists() else {}
    return media, url, metadata.get("title") or "Video transcript"


def transcribe_media(media, directory, *, model="small", language=None, source=None, title=None,
                     progress=lambda message: None):
    media = Path(media)
    if not media.is_file() or media.suffix.lower() not in MEDIA_TYPES:
        raise ValueError("Choose a supported audio or video file.")
    if media.stat().st_size > MAX_BYTES:
        raise ValueError("Media must be at most 150 MB.")
    if model not in MODELS:
        raise ValueError("Unsupported model.")
    if language and not re.fullmatch(r"[a-z]{2,3}", language):
        raise ValueError("Use a language code such as en, or automatic detection.")
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("Install FFmpeg (including ffprobe) on PATH, then restart the local transcriber.")
    from faster_whisper import WhisperModel
    if model not in _models:
        progress(f"Loading Whisper {model}. A missing model downloads once; audio stays on this computer.")
        _models.clear()
        try:
            _models[model] = WhisperModel(model, device="cpu", compute_type="int8",
                                         cpu_threads=min(4, os.cpu_count() or 1), local_files_only=True)
        except (OSError, ValueError):
            _models[model] = WhisperModel(model, device="cpu", compute_type="int8",
                                         cpu_threads=min(4, os.cpu_count() or 1))
    # Decode one bounded audio window at a time. Whole-file Whisper decoding can
    # allocate gigabytes on long YouTube interviews before yielding any progress.
    def run(command):
        return subprocess.run(command, capture_output=True, text=True, timeout=120,
                              creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    probe = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(media)])
    if probe.returncode:
        raise RuntimeError("FFmpeg could not read the audio duration.")
    duration = float(json.loads(probe.stdout)["format"]["duration"])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("The audio has no finite duration. Live streams must finish before transcription.")
    rows = []
    detected_language = language
    chunk_seconds = 180
    with tempfile.TemporaryDirectory(prefix="youchop-audio-") as temporary:
        chunk = Path(temporary) / "chunk.wav"
        for offset in range(0, math.ceil(duration), chunk_seconds):
            length = min(chunk_seconds, duration - offset)
            progress(f"Transcribing audio {clock(offset)} to {clock(offset + length)} of {clock(duration)}...")
            decoded = run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(offset),
                           "-i", str(media), "-t", str(length), "-vn", "-ac", "1", "-ar", "16000", str(chunk)])
            if decoded.returncode:
                raise RuntimeError(f"Audio decoding failed at {clock(offset)}. No complete transcript was saved.")
            segments, info = _models[model].transcribe(str(chunk), beam_size=5, vad_filter=True, language=detected_language)
            detected_language = detected_language or info.language
            for segment in segments:
                text = segment.text.strip()
                start, end = offset + segment.start, min(duration, offset + segment.end)
                if text and end > start:
                    rows.append({"start": round(start, 3), "end": round(end, 3), "text": text})
                    progress(f"Transcribing {clock(end)} of {clock(duration)}...")
    with media.open("rb") as stream:
        audio_hash = hashlib.file_digest(stream, "sha256").hexdigest()
    result = {"title": title or media.stem, "source": source, "engine": "faster-whisper",
              "model": model, "processing": "local-cpu", "language": detected_language,
              "durationSeconds": round(duration, 3), "processedAudioSeconds": round(duration, 3),
              "words": sum(len(r["text"].split()) for r in rows), "audioSha256": audio_hash,
              "quality": "Machine transcript; review names, numbers and wording, including at three-minute chunk boundaries. Full audio processed; speech accuracy not independently verified.", "segments": rows}
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for filename, text in render_outputs(result).items():
        (directory / filename).write_text(text, encoding="utf-8")
    progress("Done." if rows else "No speech detected.")
    return result


def extract(value, directory, **options):
    if str(value).startswith(("https://", "http://")):
        media, source, title = download_media(value, directory, options.get("progress", lambda message: None))
        options.pop("title", None)
        return transcribe_media(media, directory, source=source, title=title, **options)
    return transcribe_media(value, directory, **options)


def main():
    parser = argparse.ArgumentParser(description="Transcribe YouTube, Instagram or local media for free.")
    parser.add_argument("input")
    parser.add_argument("--out", default="exports/local-transcript")
    parser.add_argument("--model", choices=MODELS, default="small")
    parser.add_argument("--language", default=None)
    args = parser.parse_args()
    result = extract(args.input, args.out, model=args.model, language=args.language,
                     progress=lambda message: print(message, flush=True))
    print(json.dumps({"words": result["words"], "language": result["language"],
                      "durationSeconds": result["durationSeconds"], "output": str(Path(args.out).resolve())}))


if __name__ == "__main__":
    main()
