#!/usr/bin/env node
/**
 * youchop corpus builder — turn whole YouTube channels into text corpora.
 *
 *   node tools/corpus.mjs @AlexHormozi @bretthall9080 --local --top all --out ".../knowledge"
 *
 * Multiple channels in one run; each gets its own banner + live progress bar.
 *
 * Modes:
 *   --local   pull YouTube's own captions with yt-dlp on THIS machine (residential IP):
 *             free, no API key, no provider quota. Best for bulk corpus building.
 *   (default) hosted /api/transcripts (uses provider quota) — for parity with the website.
 *
 * Flags: --top N|all (default 20) · --min-minutes N (default 20) · --out DIR
 *        --name SLUG (single channel only) · --pause MS (default 900) · --endpoint URL
 *
 * Resume: idempotent by CONTENT — an episode already in <corpus>/_raw (matched by slug,
 * any rank prefix) is skipped. Re-run the exact command to resume after a stop.
 *
 * Per channel it writes: corpus.md (====-delimited), _raw/NNN-slug.txt, manifest.json.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(exec);
const argv = process.argv.slice(2);

// ---- arg parsing: value-flags consume the next token; bare tokens are channels ----
const VALUE_FLAGS = new Set(["--top", "--min-minutes", "--out", "--name", "--pause", "--endpoint"]);
const opt = {}; const channels = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE_FLAGS.has(a)) { opt[a.slice(2)] = argv[++i]; }
  else if (a.startsWith("--")) { opt[a.slice(2)] = true; }
  else channels.push(a);
}
if (!channels.length) {
  console.error("Usage: node corpus.mjs <@handle ...> [--local] [--top N|all] [--min-minutes N] [--out DIR] [--name SLUG] [--pause MS]");
  process.exit(1);
}
const TOP = opt.top || "20";
const MIN_MIN = Number(opt["min-minutes"] ?? 20);
const OUT_ROOT = opt.out || "./corpus";
const ENDPOINT = opt.endpoint || "https://youchop.app/api/transcripts";
const PAUSE = Number(opt.pause ?? 900);
const LOCAL = !!opt.local;
if (opt.name && channels.length > 1) { console.error("--name only works with a single channel."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => String(s).toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const q = (s) => (/[\s"&|<>^]/.test(String(s)) ? `"${String(s).replace(/"/g, '\\"')}"` : String(s));
const wc = (t) => (t.match(/\S+/g) || []).length;

// ---- yt-dlp via a resolved python (Windows-safe) ----
let PY = process.env.PYTHON || "";
async function resolvePython() {
  if (PY) return PY;
  for (const c of ["python", "py", "python3"]) { try { await pexec(`${c} -m yt_dlp --version`, { maxBuffer: 1 << 20 }); PY = c; return; } catch {} }
  console.error("\n✗ yt-dlp not runnable. Install:  python -m pip install --user yt-dlp   (or set PYTHON=/path/to/python)");
  process.exit(1);
}
async function ytdlp(args, { maxBuffer = 1 << 29 } = {}) {
  await resolvePython();
  const { stdout } = await pexec([PY, "-m", "yt_dlp", ...args].map(q).join(" "), { maxBuffer });
  return stdout;
}

// ---- caption parsing (json3) ----
function parseJson3(fp) {
  const d = JSON.parse(readFileSync(fp, "utf8"));
  const out = [];
  for (const ev of d.events || []) {
    if (ev.aAppend) continue; // rolling-caption duplicate line
    const line = (ev.segs || []).map((s) => s.utf8 || "").join("").replace(/\n/g, " ").trim();
    if (line) out.push(line);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
function pickSubFile(dir, id) {
  const files = readdirSync(dir).filter((f) => f.startsWith(id + ".") && f.endsWith(".json3"));
  if (!files.length) return null;
  return join(dir, files.sort((a, b) => (/\.en\.json3$/.test(a) ? 0 : /\.en-orig\.json3$/.test(a) ? 1 : 2) - (/\.en\.json3$/.test(b) ? 0 : /\.en-orig\.json3$/.test(b) ? 1 : 2))[0]);
}

// ---- progress bar (one line per video; file-friendly, no \r) ----
function bar(done, total, w = 22) {
  const pct = total ? done / total : 1, fill = Math.round(pct * w);
  return `[${String(done).padStart(String(total).length)}/${total}] ${"█".repeat(fill)}${"░".repeat(w - fill)} ${String(Math.round(pct * 100)).padStart(3)}%`;
}

async function processChannel(channel, idx) {
  // "@handle=folder-name" pins the output folder (so re-runs resume the right corpus)
  const eq = channel.indexOf("=");
  const rawHandle = eq > -1 ? channel.slice(0, eq) : channel;
  const forcedName = eq > -1 ? channel.slice(eq + 1) : "";
  const handle = rawHandle.replace(/^.*@/, "@").split("/")[0];
  const name = forcedName || (channels.length === 1 && opt.name) || slugify(handle.replace("@", ""));
  const OUT = join(OUT_ROOT, name), RAW = join(OUT, "_raw"), SUBS = join(OUT, "_subs");
  mkdirSync(RAW, { recursive: true });
  const findStaged = (slug) => { try { const h = readdirSync(RAW).find((f) => f.endsWith(`-${slug}.txt`)); return h ? join(RAW, h) : null; } catch { return null; } };

  console.log(`\n${"═".repeat(64)}\n▓ [${idx + 1}/${channels.length}] ${handle}  →  ${name}\n${"═".repeat(64)}`);
  const url = rawHandle.startsWith("http") ? rawHandle : `https://www.youtube.com/${handle}/videos`;
  const flat = JSON.parse(await ytdlp(["--flat-playlist", "--no-warnings", "-J", url]));
  let entries = (flat.entries || []).filter((e) => (e.duration || 0) >= MIN_MIN * 60);
  entries.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  const totalLong = entries.length;
  if (TOP !== "all") entries = entries.slice(0, Number(TOP));
  console.log(`  ${flat.entries?.length || 0} videos · ${totalLong} ≥${MIN_MIN}m · taking ${entries.length}`);

  // metadata (dates/exact views/descriptions) for the slice
  writeFileSync(join(OUT, "_urls.txt"), entries.map((e) => `https://www.youtube.com/watch?v=${e.id}`).join("\n"));
  const byId = {};
  try {
    const meta = await ytdlp(["--dump-json", "--skip-download", "--no-warnings", "--sleep-requests", "1", "-a", join(OUT, "_urls.txt")]);
    for (const line of meta.split("\n")) { if (line.trim()) try { const r = JSON.parse(line); byId[r.id] = r; } catch {} }
  } catch (e) { console.log(`  ⚠ metadata pass had errors (continuing): ${String(e.message || e).slice(0, 80)}`); }

  const manifest = entries.map((e, i) => {
    const m = byId[e.id] || {}, p = m.upload_date || "";
    return { rank: i + 1, id: e.id, title: m.title || e.title || "", slug: slugify(m.title || e.title || e.id),
      url: `https://www.youtube.com/watch?v=${e.id}`, published: p.length === 8 ? `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}` : "",
      views: m.view_count ?? e.view_count ?? 0, duration_min: Math.round((m.duration ?? e.duration ?? 0) / 60), description: m.description || "" };
  });

  const todo = manifest.filter((m) => !findStaged(m.slug));
  let ok = 0, skipped = manifest.length - todo.length, failed = 0;
  console.log(`  ${LOCAL ? "LOCAL (yt-dlp captions, no quota)" : `hosted ${new URL(ENDPOINT).host}`} · ${todo.length} to fetch, ${skipped} already staged\n`);

  let done = 0;
  for (const m of manifest) {
    const staged = findStaged(m.slug);
    if (staged) { m.words = wc(readFileSync(staged, "utf8")); continue; }
    done++;
    const rawPath = join(RAW, `${String(m.rank).padStart(3, "0")}-${m.slug}.txt`);
    let text = null;
    if (LOCAL) {
      mkdirSync(SUBS, { recursive: true });
      try {
        await ytdlp(["--write-auto-subs", "--write-subs", "--sub-langs", "en.*", "--sub-format", "json3",
          "--skip-download", "--no-warnings", "--ignore-errors", "-o", join(SUBS, "%(id)s.%(ext)s"), m.url]);
      } catch {}
      const sub = pickSubFile(SUBS, m.id);
      text = sub ? parseJson3(sub) : "";
    } else {
      try {
        const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [m.id], lang: "en" }) });
        if ([402, 403, 429].includes(r.status)) { console.log(`\n  ⛔ provider cap (HTTP ${r.status}). Stopping — re-run to resume.`); break; }
        const d = await r.json().catch(() => null); const t = d?.transcripts?.[0];
        text = t?.ok ? t.text : ""; if (t?.title) m.title = t.title;
      } catch (e) { text = ""; }
    }
    if (text && text.length) {
      writeFileSync(rawPath, text, "utf8"); m.words = wc(text); m.provider = LOCAL ? "yt-dlp-local" : "youchop-api"; ok++;
      console.log(`  ${bar(done, todo.length)} ✓ ${m.words.toLocaleString().padStart(7)}w  ${m.title.slice(0, 54)}`);
    } else {
      failed++;
      console.log(`  ${bar(done, todo.length)} ✗ no captions   ${m.title.slice(0, 54)}`);
    }
    if (!LOCAL) await sleep(PAUSE);
  }

  // write manifest + concatenated corpus
  const have = manifest.filter((m) => m.words);
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ channel: handle, name, generated: process.env.CORPUS_DATE || "", total_longform: totalLong, episodes: manifest }, null, 1), "utf8");
  const totalWords = have.reduce((s, m) => s + m.words, 0);
  let corpus = `# ${flat.channel || handle} — transcript corpus\n\n${have.length} episodes · ${totalWords.toLocaleString()} words · source: ${handle}\n` +
    `Extracted with youchop.app. Each episode delimited by ====.\n` +
    `NOTE: the creator's copyrighted work — PRIVATE input for research/synthesis, not for republication.\n\n`;
  for (const m of have.sort((a, b) => a.rank - b.rank)) {
    const sp = findStaged(m.slug); if (!sp) continue;
    corpus += `\n==== [${m.rank}] ${m.title} ====\n${m.url} · ${m.published} · ${m.duration_min} min · ${m.views.toLocaleString()} views\n\n${readFileSync(sp, "utf8")}\n`;
  }
  writeFileSync(join(OUT, "corpus.md"), corpus, "utf8");
  console.log(`\n  ▸ ${name}: ${ok} pulled, ${skipped} staged, ${failed} no-captions · ${have.length} episodes · ${totalWords.toLocaleString()} words`);
  return { name, episodes: have.length, words: totalWords, failed };
}

const summaries = [];
for (let i = 0; i < channels.length; i++) summaries.push(await processChannel(channels[i], i));
console.log(`\n${"═".repeat(64)}\n▓ ALL DONE`);
let gw = 0, ge = 0;
for (const s of summaries) { console.log(`  ${s.name.padEnd(22)} ${String(s.episodes).padStart(4)} eps · ${s.words.toLocaleString().padStart(12)} words${s.failed ? ` · ${s.failed} no-captions` : ""}`); gw += s.words; ge += s.episodes; }
console.log(`  ${"TOTAL".padEnd(22)} ${String(ge).padStart(4)} eps · ${gw.toLocaleString().padStart(12)} words`);
