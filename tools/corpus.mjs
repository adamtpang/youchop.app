#!/usr/bin/env node
/**
 * youchop corpus builder — turn a whole YouTube channel into a text corpus.
 *
 *   node tools/corpus.mjs @GregIsenberg --top 20 --out "C:/path/to/knowledge"
 *
 * Pipeline:
 *   1. Enumerate the channel with yt-dlp (no API key; runs on your own IP so
 *      YouTube doesn't datacenter-block it).
 *   2. Filter to long-form, rank by view count, take --top N.
 *   3. Pull each transcript through youchop.app/api/transcripts — sequential,
 *      polite, idempotent (skips already-staged), and STOPS on a provider cap
 *      instead of hammering.
 *   4. Write per-episode raw text, a manifest, and one concatenated corpus.md.
 *
 * Flags:
 *   --top N            how many episodes (default 20; "all" for everything)
 *   --min-minutes N    long-form threshold (default 20; 0 = no filter)
 *   --out DIR          parent output dir (default ./corpus)
 *   --name SLUG        folder name (default: derived from the handle)
 *   --endpoint URL     transcripts endpoint (default https://youchop.app/api/transcripts)
 *   --pause MS         delay between requests (default 3500)
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const pexec = promisify(exec);
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const channel = argv.find((a) => !a.startsWith("--") && (argv.indexOf(a) === 0 || !argv[argv.indexOf(a) - 1]?.startsWith("--")));

if (!channel) {
  console.error("Usage: node corpus.mjs <@handle|channel-url> [--top N] [--min-minutes N] [--out DIR] [--name SLUG]");
  process.exit(1);
}
const TOP = arg("--top", "20");
const MIN_MIN = Number(arg("--min-minutes", "20"));
const OUT_ROOT = arg("--out", "./corpus");
const ENDPOINT = arg("--endpoint", "https://youchop.app/api/transcripts");
const PAUSE = Number(arg("--pause", "3500"));
// --local pulls captions straight from YouTube with yt-dlp on this machine
// (residential IP): free, no quota, no provider. Best for bulk corpus building.
const LOCAL = argv.includes("--local");

const slugify = (s) => String(s).toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const handle = channel.replace(/^.*@/, "@").split("/")[0];
const NAME = arg("--name", slugify(handle.replace("@", "")));
const OUT = join(OUT_ROOT, NAME);
const RAW = join(OUT, "_raw");
mkdirSync(RAW, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Windows-safe: resolve a python interpreter and run through a shell so PATHEXT applies.
const q = (s) => (/[\s"&|<>^]/.test(String(s)) ? `"${String(s).replace(/"/g, '\\"')}"` : String(s));
let PY = process.env.PYTHON || "";
async function resolvePython() {
  if (PY) return PY;
  for (const cand of ["python", "py", "python3"]) {
    try { await pexec(`${cand} -m yt_dlp --version`, { maxBuffer: 1 << 20 }); PY = cand; return PY; } catch {}
  }
  console.error("\n✗ Could not run yt-dlp. Install it with:  python -m pip install --user yt-dlp");
  console.error("  (or set PYTHON=/full/path/to/python)");
  process.exit(1);
}
const ytdlp = async (args) => {
  await resolvePython();
  const cmd = [PY, "-m", "yt_dlp", ...args].map(q).join(" ");
  const { stdout } = await pexec(cmd, { maxBuffer: 1024 * 1024 * 512 });
  return stdout;
};

console.log(`\n▸ Enumerating ${handle} …`);
const url = channel.startsWith("http") ? channel : `https://www.youtube.com/${handle}/videos`;
const flat = JSON.parse(await ytdlp(["--flat-playlist", "--no-warnings", "-J", url]));
let entries = (flat.entries || []).filter((e) => (e.duration || 0) >= MIN_MIN * 60);
entries.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
const total = entries.length;
if (TOP !== "all") entries = entries.slice(0, Number(TOP));
console.log(`  ${flat.entries?.length || 0} videos · ${total} long-form (>=${MIN_MIN}m) · taking ${entries.length}`);

// full metadata (dates, exact views, descriptions) for the selected slice
console.log(`▸ Fetching metadata for ${entries.length} …`);
const urls = entries.map((e) => `https://www.youtube.com/watch?v=${e.id}`);
writeFileSync(join(OUT, "_urls.txt"), urls.join("\n"));
const metaOut = await ytdlp(["--dump-json", "--skip-download", "--no-warnings", "--sleep-requests", "1", "-a", join(OUT, "_urls.txt")]);
const byId = {};
for (const line of metaOut.split("\n")) { if (!line.trim()) continue; try { const r = JSON.parse(line); byId[r.id] = r; } catch {} }

const manifest = entries.map((e, i) => {
  const m = byId[e.id] || {};
  const p = m.upload_date || "";
  return {
    rank: i + 1, id: e.id, title: m.title || e.title || "",
    slug: slugify(m.title || e.title || e.id),
    url: `https://www.youtube.com/watch?v=${e.id}`,
    published: p.length === 8 ? `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}` : "",
    views: m.view_count ?? e.view_count ?? 0,
    duration_min: Math.round((m.duration ?? e.duration ?? 0) / 60),
    description: m.description || "",
  };
});

/* ---------- LOCAL MODE: pull captions straight from YouTube with yt-dlp ----------
 * Runs on this machine's residential IP, so none of the datacenter-IP blocking
 * (or provider quota) applies. Verified to produce byte-identical transcripts to
 * the hosted API. Free and effectively unlimited — just pace the requests.        */
function parseJson3(fp) {
  const d = JSON.parse(readFileSync(fp, "utf8"));
  const out = [];
  for (const ev of d.events || []) {
    if (ev.aAppend) continue;                      // rolling-caption duplicate
    const line = (ev.segs || []).map((s) => s.utf8 || "").join("").replace(/\n/g, " ").trim();
    if (line) out.push(line);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
function pickSubFile(dir, id) {
  const files = readdirSync(dir).filter((f) => f.startsWith(id + ".") && f.endsWith(".json3"));
  if (!files.length) return null;
  // prefer a manual "en" track, then the original-language track, then anything English
  return join(dir, files.sort((a, b) => {
    const score = (f) => (/\.en\.json3$/.test(f) ? 0 : /\.en-orig\.json3$/.test(f) ? 1 : 2);
    return score(a) - score(b);
  })[0]);
}

let ok = 0, skipped = 0, failed = 0, stopped = false;

if (LOCAL) {
  const SUBS = join(OUT, "_subs");
  mkdirSync(SUBS, { recursive: true });
  const todo = manifest.filter((m) => !existsSync(join(RAW, `${String(m.rank).padStart(3, "0")}-${m.slug}.txt`)));
  skipped = manifest.length - todo.length;
  console.log(`▸ LOCAL mode — pulling captions with yt-dlp (no API, no quota). ${todo.length} to fetch, ${skipped} already staged.\n`);
  if (todo.length) {
    const listPath = join(OUT, "_sub_urls.txt");
    writeFileSync(listPath, todo.map((m) => m.url).join("\n"));
    try {
      await ytdlp(["--write-auto-subs", "--write-subs", "--sub-langs", "en.*", "--sub-format", "json3",
        "--skip-download", "--no-warnings", "--ignore-errors",
        "--sleep-requests", String(Math.max(1, Math.round(PAUSE / 1000))),
        "-o", join(SUBS, "%(id)s.%(ext)s"), "-a", listPath]);
    } catch (e) {
      console.log(`  ⚠ yt-dlp reported errors (continuing with whatever landed): ${String(e.message || e).slice(0, 120)}`);
    }
  }
  for (const m of manifest) {
    const rawPath = join(RAW, `${String(m.rank).padStart(3, "0")}-${m.slug}.txt`);
    if (existsSync(rawPath)) { m.words = (readFileSync(rawPath, "utf8").match(/\S+/g) || []).length; continue; }
    const sub = pickSubFile(SUBS, m.id);
    if (!sub) { console.log(`  ✗ [${m.rank}] no captions available — ${m.title}`); failed++; continue; }
    const text = parseJson3(sub);
    if (!text) { console.log(`  ✗ [${m.rank}] empty captions — ${m.title}`); failed++; continue; }
    writeFileSync(rawPath, text, "utf8");
    m.words = (text.match(/\S+/g) || []).length;
    m.provider = "yt-dlp-local";
    ok++;
    console.log(`  ✓ [${m.rank}] ${m.words.toLocaleString()} words — ${m.title}`);
  }
} else {

console.log(`▸ Pulling transcripts via ${new URL(ENDPOINT).host} (sequential, ${PAUSE}ms apart) …\n`);
for (const m of manifest) {
  const rawPath = join(RAW, `${String(m.rank).padStart(3, "0")}-${m.slug}.txt`);
  if (existsSync(rawPath)) { console.log(`  [${m.rank}] SKIP (staged) — ${m.title}`); m.words = (readFileSync(rawPath, "utf8").match(/\S+/g) || []).length; skipped++; continue; }
  try {
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [m.id], lang: "en" }) });
    if ([402, 403, 429].includes(r.status)) {
      const b = await r.json().catch(() => ({}));
      console.log(`\n  ⛔ [${m.rank}] provider cap reached (HTTP ${r.status}: ${b.error || ""}). Stopping politely.`);
      console.log(`  → ${ok} pulled this run. Re-run the same command later; staged episodes are skipped automatically.`);
      stopped = true; break;
    }
    const d = await r.json().catch(() => null);
    const t = d?.transcripts?.[0];
    if (!r.ok || !t?.ok || !t.text) {
      console.log(`  ✗ [${m.rank}] no transcript — ${m.title}`);
      failed++; if (failed >= 3) { console.log("\n  ⛔ repeated failures — stopping."); stopped = true; break; }
      await sleep(PAUSE); continue;
    }
    failed = 0;
    writeFileSync(rawPath, t.text, "utf8");
    m.words = (t.text.match(/\S+/g) || []).length;
    m.provider = d.provider;
    if (t.title) m.title = t.title;
    ok++;
    console.log(`  ✓ [${m.rank}] ${m.words.toLocaleString()} words — ${m.title}`);
    await sleep(PAUSE);
  } catch (e) {
    console.log(`  ✗ [${m.rank}] ${String(e.message || e).slice(0, 70)}`);
    failed++; if (failed >= 3) { stopped = true; break; }
    await sleep(PAUSE);
  }
}
} // end API mode

// write manifest + one concatenated corpus file
const done = manifest.filter((m) => m.words);
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ channel: handle, name: NAME, generated: new Date().toISOString().slice(0, 10), total_longform: total, episodes: manifest }, null, 1), "utf8");

const totalWords = done.reduce((s, m) => s + m.words, 0);
let corpus = `# ${flat.channel || handle} — transcript corpus\n\n` +
  `${done.length} episodes · ${totalWords.toLocaleString()} words · source: ${handle}\n` +
  `Extracted with youchop.app. Each episode delimited by ====.\n` +
  `NOTE: source material is the creator's copyrighted work — treat this corpus as PRIVATE input for research/synthesis, not for republication.\n\n`;
for (const m of done) {
  const text = readFileSync(join(RAW, `${String(m.rank).padStart(3, "0")}-${m.slug}.txt`), "utf8");
  corpus += `\n==== [${m.rank}] ${m.title} ====\n${m.url} · ${m.published} · ${m.duration_min} min · ${m.views.toLocaleString()} views\n\n${text}\n`;
}
writeFileSync(join(OUT, "corpus.md"), corpus, "utf8");

console.log(`\n▸ Done: ${ok} pulled, ${skipped} already staged, ${done.length} total in corpus.`);
console.log(`  ${totalWords.toLocaleString()} words → ${join(OUT, "corpus.md")}`);
console.log(`  manifest → ${join(OUT, "manifest.json")}   raw → ${RAW}`);
if (stopped) console.log(`  ⚠ stopped early — re-run to resume.`);
