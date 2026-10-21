"""Loopback-only UI for the local transcriber. Never deploy this to Vercel."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import re
import threading
from urllib.parse import urlsplit
import uuid

from local_transcribe import MAX_BYTES, MEDIA_TYPES, MODELS, extract, normalize_media_url

ASSETS = Path(__file__).parent / "transcribe-ui"
OUTPUTS = {"transcript.txt": "text/plain", "transcript.md": "text/markdown",
           "transcript.json": "application/json", "transcript.srt": "text/plain"}


class State:
    def __init__(self, directory):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.token = secrets.token_urlsafe(32)
        self.jobs = {}
        self.uploads = {}
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=1)

    def progress(self, job_id, message):
        with self.lock:
            self.jobs[job_id]["message"] = message

    def work(self, job_id, value, model, title):
        try:
            with self.lock:
                self.jobs[job_id]["status"] = "running"
            result = extract(value, self.directory / job_id, model=model, title=title,
                             progress=lambda message: self.progress(job_id, message))
            with self.lock:
                self.jobs[job_id].update(status="done", message="Done." if result["segments"] else "No speech detected.", result=result)
        except Exception as error:
            with self.lock:
                self.jobs[job_id].update(status="error", message=str(error))


def handler_for(state):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log pasted URLs, media tokens or transcript text.

        def local_request(self):
            port = self.server.server_address[1]
            hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
            origin = self.headers.get("Origin")
            return self.headers.get("Host") in hosts and (not origin or origin in {f"http://{h}" for h in hosts} or bool(re.fullmatch(r"chrome-extension://[a-p]{32}", origin)))

        def respond(self, code, payload, content_type="application/json"):
            data = json.dumps(payload).encode() if content_type == "application/json" else payload
            self.send_response(code)
            self.send_header("Content-Type", content_type + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.local_request():
                return self.respond(403, {"error": "Local requests only."})
            route = urlsplit(self.path).path
            assets = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"), "/style.css": ("style.css", "text/css")}
            if route in assets:
                filename, mime = assets[route]
                return self.respond(200, (ASSETS / filename).read_bytes(), mime)
            if route == "/api/session":
                return self.respond(200, {"token": state.token, "protocol": 2})
            parts = route.strip("/").split("/")
            if len(parts) in {3, 4} and parts[:2] == ["api", "jobs"]:
                with state.lock:
                    job = dict(state.jobs.get(parts[2], {}))
                if not job:
                    return self.respond(404, {"error": "Unknown job."})
                if len(parts) == 3:
                    return self.respond(200, job)
                name = parts[3]
                if name in OUTPUTS and job["status"] == "done":
                    return self.respond(200, (state.directory / parts[2] / name).read_bytes(), OUTPUTS[name])
            return self.respond(404, {"error": "Not found."})

        def do_POST(self):
            if not self.local_request() or not secrets.compare_digest(self.headers.get("X-YouChop-Token", ""), state.token):
                return self.respond(403, {"error": "Open the local YouChop page before starting a job."})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                route = urlsplit(self.path).path
                limit = MAX_BYTES if route == "/api/upload" else 8192
                if not 0 < length <= limit:
                    return self.respond(413, {"error": "Request too large or empty."})
                if route == "/api/upload":
                    filename = Path(self.headers.get("X-Filename", "media")).name
                    suffix = Path(filename).suffix.lower()
                    if suffix not in MEDIA_TYPES:
                        raise ValueError("Choose an audio or video file.")
                    token = uuid.uuid4().hex
                    folder = state.directory / ("upload-" + token)
                    folder.mkdir()
                    media = folder / ("media" + suffix)
                    with media.open("wb") as stream:
                        remaining = length
                        while remaining:
                            chunk = self.rfile.read(min(1024 * 1024, remaining))
                            if not chunk:
                                raise ValueError("Upload interrupted.")
                            stream.write(chunk)
                            remaining -= len(chunk)
                    with state.lock:
                        state.uploads[token] = (media, filename)
                    return self.respond(200, {"upload": token})
                if route != "/api/jobs":
                    return self.respond(404, {"error": "Not found."})
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError("Expected a JSON object.")
                model = data.get("model", "small")
                if model not in MODELS:
                    raise ValueError("Unsupported model.")
                if data.get("upload"):
                    with state.lock:
                        upload = state.uploads.get(data["upload"])
                    if not upload:
                        raise ValueError("Upload the file first.")
                    value, title = upload
                else:
                    value, title = normalize_media_url(data.get("url", "")), None
                with state.lock:
                    # Reopening the modal reconnects to existing work (including a
                    # completed result), instead of downloading the same audio again.
                    if isinstance(value, str):
                        existing = next((j for j in reversed(list(state.jobs.values()))
                                         if j.get("source") == value and j.get("model") == model
                                         and j["status"] in {"queued", "running", "done"}), None)
                        if existing:
                            return self.respond(202, {"id": existing["id"]})
                    if sum(j["status"] in {"queued", "running"} for j in state.jobs.values()) >= 4:
                        return self.respond(429, {"error": "Four jobs are already active. Wait for one to finish."})
                    job_id = uuid.uuid4().hex
                    state.jobs[job_id] = {"id": job_id, "status": "queued", "message": "Queued.", "source": value if isinstance(value, str) else None, "model": model}
                state.pool.submit(state.work, job_id, value, model, title)
                return self.respond(202, {"id": job_id})
            except (ValueError, TypeError, KeyError) as error:
                return self.respond(400, {"error": str(error)})

        def do_OPTIONS(self):
            return self.respond(403, {"error": "Cross-origin access is not supported."})

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8876)
    parser.add_argument("--out", default="exports/local-transcripts")
    args = parser.parse_args()
    state = State(args.out)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(state))
    print(f"YouChop local transcription: http://127.0.0.1:{args.port}\nPress Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        state.pool.shutdown(wait=True)


if __name__ == "__main__":
    main()
