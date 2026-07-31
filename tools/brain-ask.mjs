#!/usr/bin/env node
/**
 * ask.mjs — ask your corpus questions. Local, keyless, free.
 *
 *   npm install @huggingface/transformers
 *   node ask.mjs "what does this channel say about pricing"
 *
 * Embeddings run on your own machine (bge-small-en-v1.5 via ONNX/CPU). No API key,
 * no account, no rate limits, no cost, nothing leaves your computer. The first run
 * downloads a ~35MB model and builds embeddings.json (a few minutes for a large
 * corpus); every run after that is instant.
 *
 *   --rebuild   re-embed from scratch (after adding pages)
 *   --top N     how many results (default 5)
 *   --raw       allow several hits from the same episode (default: one each)
 */
import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = join(HERE, "pages");
const CACHE = join(HERE, "embeddings.json");
const MODEL = "Xenova/bge-small-en-v1.5";
const QPREFIX = "Represent this sentence for searching relevant passages: ";

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const question = argv.filter((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--top").join(" ").trim();

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
function chunk(text, target = 1100, overlap = 200) {
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

function loadChunks() {
  const chunks = [];
  for (const f of readdirSync(PAGES).filter((x) => x.endsWith(".md"))) {
    const { fm, body } = frontmatter(readFileSync(join(PAGES, f), "utf8").replace(/\r\n/g, "\n"));
    for (const c of chunk(body.replace(/\s+/g, " ").trim())) {
      // pull the nearest timestamp deep link out of the chunk, if present
      const link = (c.match(/\((https:\/\/www\.youtube\.com\/watch\?v=[^)]*t=\d+s)\)/) || [])[1];
      chunks.push({ title: fm.title || f, url: link || fm.source_url || "", text: c });
    }
  }
  return chunks;
}

async function build() {
  const chunks = loadChunks();
  console.log(`${chunks.length} chunks from ${readdirSync(PAGES).filter((f) => f.endsWith(".md")).length} pages`);
  console.log(`loading ${MODEL} (one-time ~35MB download, then cached)...`);
  const extract = await pipeline("feature-extraction", MODEL);
  const vecs = [];
  const B = 32;
  const t0 = Date.now();
  for (let i = 0; i < chunks.length; i += B) {
    const out = await extract(chunks.slice(i, i + B).map((c) => c.text), { pooling: "mean", normalize: true });
    const d = out.dims[1];
    for (let r = 0; r < Math.min(B, chunks.length - i); r++) vecs.push(Array.from(out.data.slice(r * d, (r + 1) * d)));
    process.stdout.write(`  ${Math.round(100 * Math.min(i + B, chunks.length) / chunks.length)}%\r`);
  }
  console.log(`\nembedded in ${Math.round((Date.now() - t0) / 1000)}s, cost $0.00`);
  writeFileSync(CACHE, JSON.stringify({ model: MODEL, chunks, vecs }), "utf8");
  return { chunks, vecs };
}

let store;
if (flag("--rebuild") || !existsSync(CACHE)) store = await build();
else store = JSON.parse(readFileSync(CACHE, "utf8"));

if (!question) {
  console.log(`\nindex ready: ${store.chunks.length} chunks.\n\n  node ask.mjs "your question here"\n`);
  process.exit(0);
}

const extract = await pipeline("feature-extraction", MODEL);
const qout = await extract([QPREFIX + question], { pooling: "mean", normalize: true });
const qv = Array.from(qout.data.slice(0, qout.dims[1]));
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

const scored = store.chunks
  .map((c, i) => ({ ...c, score: dot(qv, store.vecs[i]) }))
  .sort((a, b) => b.score - a.score);

const want = Number(val("--top", 5));
let hits = scored;
if (!flag("--raw")) { // one hit per episode, so you get breadth not one loud source
  const seen = new Set();
  hits = scored.filter((s) => (seen.has(s.title) ? false : (seen.add(s.title), true)));
}
console.log(`\nQ: ${question}\n${"=".repeat(70)}`);
for (const h of hits.slice(0, want)) {
  console.log(`\n[${h.score.toFixed(3)}] ${h.title}`);
  if (h.url) console.log(`  ${h.url}`);
  console.log(`  "${h.text.slice(0, 280).replace(/\[[\d:]+\]\([^)]*\)\s*/g, "").trim()}..."`);
}
console.log("");
