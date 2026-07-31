#!/usr/bin/env node
/**
 * ask.mjs — ask your corpus questions. Local, keyless, free.
 *
 *   npm install
 *   node ask.mjs "what does this channel say about pricing"
 *
 * Embeddings run on your own machine (bge-small-en-v1.5 via ONNX/CPU). No API key,
 * no account, no rate limits, no cost, and nothing leaves your computer.
 *
 * Exports usable by youchop's exporter (so the shipped index is built by exactly
 * this code, guaranteeing the cached vectors match the chunking used at query time):
 *   loadChunks(pagesDir) -> chunks[]
 *   buildIndex(pagesDir, cacheFile, log?) -> { chunks, vecs }
 *
 *   --rebuild   re-embed from scratch (after adding or editing pages)
 *   --top N     how many results (default 5)
 *   --raw       allow several hits from the same episode (default: one each)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MODEL = "Xenova/bge-small-en-v1.5";
const QPREFIX = "Represent this sentence for searching relevant passages: ";

// transformers is imported lazily so this file can be imported for its helpers
// (and its CLI can print a useful message) without the dependency present.
let _extract = null;
export async function embedder() {
  if (_extract) return _extract;
  let pipeline;
  try { ({ pipeline } = await import("@huggingface/transformers")); }
  catch {
    throw new Error("missing dependency: run `npm install` in this folder first");
  }
  _extract = await pipeline("feature-extraction", MODEL);
  return _extract;
}

function frontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = {};
  if (m) for (const line of m[1].split("\n")) {
    const mm = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (mm) { let v = mm[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); fm[mm[1]] = v; }
  }
  return { fm, body: m ? raw.slice(m[0].length) : raw };
}

// Sentence-aware chunks with overlap. Timestamp deep links stay attached to their
// text, so a hit can point at the exact moment in the video.
export function chunk(text, target = 1100, overlap = 200) {
  const sents = text.match(/[^.!?]+[.!?]+|\S+$/g) || [text];
  const out = [];
  let cur = "";
  for (const s of sents) {
    if (cur.length + s.length > target && cur.length) { out.push(cur.trim()); cur = cur.slice(Math.max(0, cur.length - overlap)); }
    cur += s;
  }
  if (cur.trim().length > 80) out.push(cur.trim());
  return out;
}

export function loadChunks(pagesDir) {
  const chunks = [];
  for (const f of readdirSync(pagesDir).filter((x) => x.endsWith(".md")).sort()) {
    const { fm, body } = frontmatter(readFileSync(join(pagesDir, f), "utf8").replace(/\r\n/g, "\n"));
    for (const c of chunk(body.replace(/\s+/g, " ").trim())) {
      const link = (c.match(/\((https:\/\/www\.youtube\.com\/watch\?v=[^)]*t=\d+s)\)/) || [])[1];
      chunks.push({ title: fm.title || f, url: link || fm.source_url || "", text: c });
    }
  }
  return chunks;
}

// signature lets us detect a cache that no longer matches the pages
export function signature(pagesDir) {
  const files = readdirSync(pagesDir).filter((f) => f.endsWith(".md")).sort();
  let bytes = 0;
  for (const f of files) bytes += readFileSync(join(pagesDir, f)).length;
  return `${files.length}:${bytes}`;
}

export async function buildIndex(pagesDir, cacheFile, log = () => {}) {
  const chunks = loadChunks(pagesDir);
  const extract = await embedder();
  const vecs = [];
  const B = 32;
  const t0 = Date.now();
  for (let i = 0; i < chunks.length; i += B) {
    const out = await extract(chunks.slice(i, i + B).map((c) => c.text), { pooling: "mean", normalize: true });
    const d = out.dims[1];
    for (let r = 0; r < Math.min(B, chunks.length - i); r++) vecs.push(Array.from(out.data.slice(r * d, (r + 1) * d)));
    log(Math.round(100 * Math.min(i + B, chunks.length) / chunks.length), chunks.length);
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  writeFileSync(cacheFile, JSON.stringify({ model: MODEL, sig: signature(pagesDir), chunks, vecs }), "utf8");
  return { chunks, vecs, secs };
}

/* ---------------- CLI ---------------- */
async function main() {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const PAGES = join(HERE, "pages");
  const CACHE = join(HERE, "embeddings.json");
  const argv = process.argv.slice(2);
  const flag = (f) => argv.includes(f);
  const val = (f, d) => { const i = argv.indexOf(f); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
  const question = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--top").join(" ").trim();

  let store = null;
  if (!flag("--rebuild") && existsSync(CACHE)) {
    try {
      store = JSON.parse(readFileSync(CACHE, "utf8"));
      if (store.sig && store.sig !== signature(PAGES)) {
        console.log("pages changed since the index was built; re-embedding...");
        store = null;
      }
    } catch { store = null; }
  }
  if (!store) {
    console.log("building the index (one-time; downloads a ~35MB model)...");
    store = await buildIndex(PAGES, CACHE, (pct) => process.stdout.write(`  ${pct}%\r`));
    console.log(`\nindexed in ${store.secs}s, cost $0.00`);
  }

  if (!question) {
    console.log(`\nindex ready: ${store.chunks.length} chunks.\n\n  node ask.mjs "your question here"\n`);
    return;
  }

  const extract = await embedder();
  const qout = await extract([QPREFIX + question], { pooling: "mean", normalize: true });
  const qv = Array.from(qout.data.slice(0, qout.dims[1]));
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

  const scored = store.chunks
    .map((c, i) => ({ ...c, score: dot(qv, store.vecs[i]) }))
    .sort((a, b) => b.score - a.score);

  let hits = scored;
  if (!flag("--raw")) { // one hit per episode, so you get breadth not one loud source
    const seen = new Set();
    hits = scored.filter((s) => (seen.has(s.title) ? false : (seen.add(s.title), true)));
  }
  console.log(`\nQ: ${question}\n${"=".repeat(70)}`);
  for (const h of hits.slice(0, Number(val("--top", 5)))) {
    console.log(`\n[${h.score.toFixed(3)}] ${h.title}`);
    if (h.url) console.log(`  ${h.url}`);
    console.log(`  "${h.text.slice(0, 280).replace(/\[[\d:]+\]\([^)]*\)\s*/g, "").trim()}..."`);
  }
  console.log("");
}

// run the CLI only when executed directly, not when imported by the exporter
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("\n" + (e.message || e)); process.exit(1); });
}
