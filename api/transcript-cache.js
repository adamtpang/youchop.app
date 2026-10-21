/* Shared transcript cache for Vercel Functions.
 *
 * Successful provider-fetched public YouTube transcripts are stored once as the
 * timestamped canonical form. Every API surface imports fetchTranscripts(), so
 * /extract, /chop, and the extension's hosted fallback all reuse the same entry.
 * Browser-local/private transcripts are deliberately not written here.
 */

const CACHE_NAMESPACE = "youtube-transcripts-v1";
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const CACHE_RECORD_VERSION = 1;
const MAX_CACHE_BYTES = 1_800_000; // Runtime Cache items are limited to 2 MB.

let backendOverride;
let resolvedBackend;

function cacheBackend() {
  if (backendOverride !== undefined) return backendOverride;
  if (resolvedBackend !== undefined) return resolvedBackend;
  try {
    const { getCache } = require("@vercel/functions");
    resolvedBackend = getCache({ namespace: CACHE_NAMESPACE });
  } catch {
    // Local scripts and tests can run without Vercel's runtime environment. A
    // cache outage must never turn transcript extraction into an outage.
    resolvedBackend = null;
  }
  return resolvedBackend;
}

function normalizeLanguage(lang) {
  const value = String(lang || "en").toLowerCase();
  return /^[a-z-]{2,8}$/.test(value) ? value : "en";
}

function cacheKey(videoId, lang) {
  return `${String(videoId || "")}:${normalizeLanguage(lang)}`;
}

function validTranscript(value, videoId) {
  return !!(
    value &&
    value.version === CACHE_RECORD_VERSION &&
    value.ok === true &&
    value.videoId === videoId &&
    typeof value.text === "string" &&
    value.text.trim()
  );
}

async function readCachedTranscripts(ids, lang) {
  const backend = cacheBackend();
  const hits = new Map();
  if (!backend) return hits;

  await Promise.all([...new Set(ids || [])].map(async (videoId) => {
    try {
      const value = await backend.get(cacheKey(videoId, lang));
      if (validTranscript(value, videoId)) hits.set(videoId, value);
    } catch {
      // Treat a regional cache miss/outage exactly like an ordinary miss.
    }
  }));
  return hits;
}

async function writeCachedTranscripts(transcripts, lang) {
  const backend = cacheBackend();
  if (!backend) return 0;
  let writes = 0;

  await Promise.all((transcripts || []).map(async (transcript) => {
    if (!transcript?.ok || !/^[\w-]{11}$/.test(String(transcript.videoId || "")) || !String(transcript.text || "").trim()) {
      return;
    }
    const record = {
      version: CACHE_RECORD_VERSION,
      videoId: transcript.videoId,
      title: String(transcript.title || "").slice(0, 500),
      author: String(transcript.author || "").slice(0, 500),
      language: String(transcript.language || normalizeLanguage(lang)).slice(0, 32),
      ok: true,
      text: String(transcript.text),
      cachedAt: new Date().toISOString(),
    };
    if (Buffer.byteLength(JSON.stringify(record), "utf8") > MAX_CACHE_BYTES) return;
    try {
      await backend.set(cacheKey(record.videoId, lang), record, {
        ttl: CACHE_TTL_SECONDS,
        tags: ["youtube-transcripts", `youtube-video-${record.videoId}`],
        name: "youtube-transcript",
      });
      writes++;
    } catch {
      // Provider success still wins even when caching is temporarily unavailable.
    }
  }));
  return writes;
}

function stripTimestamps(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[(?:\d{1,3}:)?\d{1,2}:\d{2}\]\s*/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function setBackendForTests(backend) {
  backendOverride = backend;
}

module.exports = {
  CACHE_TTL_SECONDS,
  cacheKey,
  normalizeLanguage,
  readCachedTranscripts,
  writeCachedTranscripts,
  stripTimestamps,
  setBackendForTests,
};
