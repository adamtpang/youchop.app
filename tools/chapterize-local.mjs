#!/usr/bin/env node
/**
 * Chapterize one YouTube video for personal use: captions pulled locally via
 * yt-dlp (free, no provider quota) and chapter titles written by your local
 * `claude` CLI (your Claude subscription, no separate ANTHROPIC_API_KEY billing).
 *
 *   node tools/chapterize-local.mjs <youtube-url-or-id>
 *
 * Needs `claude` (Claude Code CLI, already logged in to your subscription) and
 * yt-dlp on PATH. Nothing here touches the hosted api/chapterize.js pipeline or
 * its provider quota; this is entirely local, matching tools/corpus.mjs --local.
 */
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const pexec = promisify(exec);

const videoArg = process.argv[2];
const outFlagIdx = process.argv.indexOf("--out");
const outFile = outFlagIdx > -1 ? process.argv[outFlagIdx + 1] : null;
if (!videoArg) {
  console.error("Usage: node tools/chapterize-local.mjs <youtube-url-or-id> [--out FILE]");
  process.exit(1);
}

function videoIdFrom(s) {
  const str = String(s);
  const m =
    str.match(/[?&]v=([\w-]{11})/) ||
    str.match(/youtu\.be\/([\w-]{11})/) ||
    str.match(/\/shorts\/([\w-]{11})/) ||
    str.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
const videoId = videoIdFrom(videoArg);
if (!videoId) {
  console.error("Not a valid YouTube URL or 11-character video ID.");
  process.exit(1);
}
const url = `https://www.youtube.com/watch?v=${videoId}`;

function hms(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ":" : "") + (h ? String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}

let PY = process.env.PYTHON || "";
async function resolvePython() {
  if (PY) return PY;
  for (const c of ["python", "py", "python3"]) {
    try { await pexec(`${c} -m yt_dlp --version`, { maxBuffer: 1 << 20 }); PY = c; return; } catch { /* try next */ }
  }
  console.error("yt-dlp not runnable. Install: python -m pip install --user yt-dlp   (or set PYTHON=/path/to/python)");
  process.exit(1);
}
async function ytdlp(args, opts = {}) {
  await resolvePython();
  const q = (s) => (/[\s"&|<>^]/.test(String(s)) ? `"${String(s).replace(/"/g, '\\"')}"` : String(s));
  const { stdout } = await pexec([PY, "-m", "yt_dlp", ...args].map(q).join(" "), { maxBuffer: 1 << 28, ...opts });
  return stdout;
}

function parseJson3Timed(fp) {
  const d = JSON.parse(readFileSync(fp, "utf8"));
  const out = [];
  for (const ev of d.events || []) {
    if (ev.aAppend) continue; // rolling-caption duplicate line
    const line = (ev.segs || []).map((s) => s.utf8 || "").join("").replace(/\n/g, " ").trim();
    if (line) out.push({ t: Math.floor((ev.tStartMs || 0) / 1000), text: line });
  }
  return out;
}
function pickSubFile(dir, id) {
  const files = readdirSync(dir).filter((f) => f.startsWith(id + ".") && f.endsWith(".json3"));
  if (!files.length) return null;
  const rank = (f) => (/\.en\.json3$/.test(f) ? 0 : /\.en-orig\.json3$/.test(f) ? 1 : 2);
  return join(dir, files.sort((a, b) => rank(a) - rank(b))[0]);
}

// Piped stdin, not shell redirection: avoids Windows-vs-POSIX quoting
// differences entirely and matches the manual test this script is based on
// (`cat prompt.txt | claude -p`).
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !out.trim()) return reject(new Error(err.trim() || `claude exited with code ${code}`));
      resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function cleanTitle(s) {
  let t = String(s || "").replace(/[\[\]]/g, "").replace(/^["'“”]+|["'“”]+$/g, "").replace(/\s+/g, " ").trim();
  if (t.length > 70) t = t.slice(0, 67).replace(/\s+\S*$/, "") + "…";
  return t || "Section";
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "yc-chapterize-"));
  try {
    console.log("▸ pulling captions locally (yt-dlp, free, no provider quota) …");
    await ytdlp([
      "--write-auto-subs", "--write-subs", "--sub-langs", "en.*", "--sub-format", "json3",
      "--skip-download", "--no-warnings", "--ignore-errors", "-o", join(dir, "%(id)s.%(ext)s"), url,
    ]);
    const sub = pickSubFile(dir, videoId);
    if (!sub) { console.error("No captions found for this video (creator hasn't added any, and none are auto-generated)."); process.exit(1); }
    const segs = parseJson3Timed(sub);
    if (!segs.length) { console.error("Captions file was empty."); process.exit(1); }

    console.log("▸ fetching title/channel …");
    const meta = JSON.parse(await ytdlp(["--dump-json", "--skip-download", "--no-warnings", url]));
    const title = meta.title || videoId;
    const channel = meta.channel || meta.uploader || "";

    const transcript = segs.map((s) => `[${hms(s.t)}] ${s.text}`).join("\n");
    const clipped = transcript.length > 120_000 ? transcript.slice(0, 120_000) + "\n…[truncated]" : transcript;

    const prompt = `You write YouTube description chapters from a timestamped transcript.

Rules:
- Return ONLY a JSON array: [{"start":0,"title":"..."}, ...]
- First chapter MUST have start: 0
- start is integer seconds from the beginning of the video
- Titles: 3-7 words, topic-based, search-friendly. Never "Introduction", "Main Discussion", "Conclusion", "Part 1"
- Prefer natural topic shifts over fixed intervals
- About 1 chapter per 1.5-3 minutes; min 3, max 20
- No markdown, no commentary, no trailing commas

Video title: ${title}
Channel: ${channel}

Timestamped transcript:
${clipped}`;

    console.log("▸ asking your local Claude (subscription, no API billing) …");
    const raw = await runClaude(prompt);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { console.error("Could not find a JSON array in Claude's response:\n" + raw.slice(0, 500)); process.exit(1); }
    let chapters;
    try { chapters = JSON.parse(jsonMatch[0]); }
    catch { console.error("Bad JSON from Claude:\n" + jsonMatch[0].slice(0, 500)); process.exit(1); }
    if (!Array.isArray(chapters) || !chapters.length) { console.error("Empty chapter list."); process.exit(1); }
    chapters[0].start = 0;

    const paste = chapters
      .map((c) => `${c.start === 0 ? "0:00" : hms(Math.max(0, Math.floor(Number(c.start) || 0)))} ${cleanTitle(c.title)}`)
      .join("\n");

    const block = `${title}\n${url}\n\n${paste}\n`;
    console.log("\n" + block);
    console.log(`▸ ${chapters.length} chapters · paste-ready above`);
    if (outFile) { writeFileSync(outFile, block, "utf8"); console.log(`▸ also written to ${outFile}`); }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
