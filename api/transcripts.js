// POST /api/transcripts  { ids: [videoId,...], timestamps?, mock?, debug? }
// Pluggable transcript backends with automatic fallback:
//   TRANSCRIPT_PROVIDER = "apify" | "supadata" | "transcriptapi" | "ytio"  forces one;
//   otherwise every configured provider is tried in order apify -> supadata ->
//   transcriptapi -> ytio (a provider that errors, e.g. monthly credits exhausted,
//   falls through to the next).
//   - apify:         APIFY_TOKEN (free $5/mo credits). Actor runs on Apify's infra,
//               which survives YouTube's datacenter-IP blocking that kills scraping
//               on Vercel. Actor: karamelo/youtube-transcripts (override
//               APIFY_TRANSCRIPT_ACTOR). Verified output shape: { videoId, captions,
//               channelName? } where captions is a string (singleStringText),
//               [{start,end,text}] (textWithTimestamps), or [string] (captions).
//   - supadata:      SUPADATA_API_KEY (free 100 transcripts/mo, no card). One request
//               per video: GET api.supadata.ai/v1/transcript?url=… (x-api-key header).
//   - transcriptapi: TRANSCRIPTAPI_KEY, transcriptapi.com (free 100 credits, no card,
//               then $5/mo). GET transcriptapi.com/api/v2/youtube/transcript?video_url=…
//               (Authorization: Bearer). Standard REST error codes: 402 = out of
//               credits, 429/408 = retryable.
//   - ytio:          YT_TRANSCRIPT_TOKEN, youtube-transcript.io (paid, optional).
// Successful public transcripts are cached by video id + language for 30 days in
// Vercel Runtime Cache. Batches capped at 50 ids. Mock mode needs no key.

const YTIO_BASE = "https://www.youtube-transcript.io/api";
const { decodeCaptionText } = require("./text");
const APIFY_ACTOR = process.env.APIFY_TRANSCRIPT_ACTOR || "karamelo~youtube-transcripts";
const {
  normalizeLanguage,
  readCachedTranscripts,
  writeCachedTranscripts,
  stripTimestamps,
} = require("./transcript-cache");

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

function hms(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ":" : "") + (h ? String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}
function vidFromUrl(u) {
  const s = String(u || "");
  const m = s.match(/[?&]v=([\w-]{11})/) || s.match(/youtu\.be\/([\w-]{11})/) || s.match(/\/shorts\/([\w-]{11})/) || s.match(/([\w-]{11})/);
  return m ? m[1] : "";
}

/* ---------- provider: apify ---------- */
function extractApifyText(item, withTs) {
  const direct = item.singleStringText || item.transcriptText || item.text || item.content;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (typeof item.captions === "string" && item.captions.trim()) return item.captions.trim();
  if (typeof item.transcript === "string" && item.transcript.trim()) return item.transcript.trim();
  const segs = item.captions || item.transcript || item.segments;
  if (Array.isArray(segs) && segs.length) {
    if (typeof segs[0] === "string") {
      return segs.map((s) => String(s).replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
    }
    return segs.map((s) => {
      const t = String(s.text || s.caption || "").replace(/\s+/g, " ").trim();
      return withTs && (s.start != null || s.offset != null) ? "[" + hms(s.start ?? s.offset) + "] " + t : t;
    }).filter(Boolean).join(withTs ? "\n" : " ");
  }
  let best = "";
  for (const k of Object.keys(item)) if (typeof item[k] === "string" && item[k].length > best.length) best = item[k];
  return best.trim();
}
function normalizeApify(items, ids, withTs) {
  const arr = Array.isArray(items) ? items : (items && items.items) || [];
  const byId = {};
  arr.forEach((it) => {
    const id = it.videoId || it.id || vidFromUrl(it.url || it.videoUrl || it.link || it.video_url);
    if (!id) return;
    const text = extractApifyText(it, withTs);
    byId[id] = {
      videoId: id,
      title: it.title || it.videoTitle || "",
      author: it.channelName || it.author || it.channel || "",
      language: it.language || "",
      ok: !!(text && text.length),
      text,
    };
  });
  return ids.map((id) => byId[id] || { videoId: id, title: "", author: "", ok: false, text: "" });
}
async function viaApify(ids, withTs, debug) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { error: { status: 500, body: { error: "no_apify_token", message: "Server is missing APIFY_TOKEN (free Apify tier)." } } };
  // `timeout` (seconds) tells Apify's own platform to stop waiting and respond,
  // rather than holding the sync connection open indefinitely. Confirmed live
  // 2026-08: with the account over its monthly limit the actor never starts, but
  // run-sync-get-dataset-items still hung 30s+ on a SINGLE video instead of
  // failing fast, which occasionally pushed the whole request past Vercel's 60s
  // maxDuration into a bare FUNCTION_INVOCATION_TIMEOUT. The client-side
  // AbortSignal is a backstop in case Apify does not honor the query param.
  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=15`;
  const input = {
    urls: ids.map((id) => "https://www.youtube.com/watch?v=" + id),
    outputFormat: withTs ? "textWithTimestamps" : "singleStringText",
    channelNameBoolean: true,
    maxRetries: 6,
  };
  let r;
  try {
    r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      signal: AbortSignal.timeout(18000),
    });
  } catch (e) {
    const timedOut = e && (e.name === "TimeoutError" || e.name === "AbortError");
    return { error: { status: 504, body: { error: "apify_error", status: 504, detail: timedOut ? "apify did not respond in time" : String(e.message || e) } } };
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = data && (data.error && data.error.message || data.message) || "";
    const limitHit = r.status === 402 || /limit exceeded|payment/i.test(String(msg));
    return { error: { status: limitHit ? 402 : r.status, body: { error: "apify_error", status: r.status, detail: msg || data } } };
  }
  const out = { transcripts: normalizeApify(data, ids, withTs) };
  if (debug) out.raw = data;
  return out;
}

/* ---------- provider: supadata (free 100/mo) ---------- */
function normalizeSupadata(id, data, withTs) {
  if (!data) return { videoId: id, title: "", author: "", ok: false, text: "", reason: "no response body" };
  let text = "";
  if (typeof data.content === "string") text = data.content.trim();
  else if (Array.isArray(data.content)) {
    text = data.content.map((s) => {
      const t = String(s.text || "").replace(/\s+/g, " ").trim();
      return withTs && s.offset != null ? "[" + hms(Math.floor(Number(s.offset) / 1000)) + "] " + t : t;
    }).filter(Boolean).join(withTs ? "\n" : " ");
  }
  const out = { videoId: id, title: "", author: "", language: data.lang || "", ok: !!text, text };
  // Supadata can answer HTTP 200 with no transcript, e.g. its own scrape failed for
  // this specific video even though YouTube itself serves captions fine. Carry
  // whatever it says why, so the client isn't left guessing "captions disabled"
  // when that isn't actually what happened.
  if (!out.ok) out.reason = data.error || data.message || data.code || "provider returned no transcript";
  return out;
}
async function viaSupadata(ids, withTs, debug, lang) {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) return { error: { status: 500, body: { error: "no_supadata_key", message: "Server is missing SUPADATA_API_KEY (free tier)." } } };
  lang = lang || "en";
  const results = [];
  let hardError = null;
  const CONC = 4;
  const fetchOne = async (id, useLang) => {
    // Videos with many translated tracks (e.g. TED talks) return an arbitrary
    // language when none is specified, so we ALWAYS ask for the preferred
    // language first, then retry without it if that track doesn't exist.
    const qs = "url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id)
      + (useLang ? "&lang=" + encodeURIComponent(lang) : "")
      + (withTs ? "" : "&text=true");
    let r = await fetch("https://api.supadata.ai/v1/transcript?" + qs, { headers: { "x-api-key": key } });
    if (r.status === 429) {
      await new Promise((z) => setTimeout(z, 2200));
      r = await fetch("https://api.supadata.ai/v1/transcript?" + qs, { headers: { "x-api-key": key } });
    }
    return r;
  };
  for (let i = 0; i < ids.length && !hardError; i += CONC) {
    const group = ids.slice(i, i + CONC);
    const settled = await Promise.all(group.map(async (id) => {
      let r = await fetchOne(id, true);
      let data = await r.json().catch(() => null);
      if (r.status === 401 || r.status === 402 || r.status === 403) { hardError = { status: r.status, body: { error: "supadata_error", status: r.status, detail: data } }; return null; }
      let out = r.ok ? normalizeSupadata(id, data, withTs) : { videoId: id, title: "", author: "", ok: false, text: "", reason: `provider HTTP ${r.status}` };
      if (!out.ok) {
        // preferred language track missing, take whatever the video has
        r = await fetchOne(id, false);
        data = await r.json().catch(() => null);
        if (r.status === 401 || r.status === 402 || r.status === 403) { hardError = { status: r.status, body: { error: "supadata_error", status: r.status, detail: data } }; return null; }
        if (r.ok) out = normalizeSupadata(id, data, withTs);
        else out.reason = out.reason || `provider HTTP ${r.status}`;
      }
      return out;
    }));
    settled.forEach((x) => { if (x) results.push(x); });
  }
  if (hardError && !results.some((t) => t.ok)) return { error: hardError };
  const byId = {}; results.forEach((t) => { byId[t.videoId] = t; });
  return { transcripts: ids.map((id) => byId[id] || { videoId: id, title: "", author: "", ok: false, text: "" }) };
}

/* ---------- provider: transcriptapi.com (free 100 credits, no card, then $5/mo) ---------- */
function normalizeTranscriptApi(id, data, withTs) {
  const segs = (data && data.transcript) || [];
  const text = segs.map((s) => {
    const t = String(s.text || "").replace(/\s+/g, " ").trim();
    return withTs ? "[" + hms(s.start || 0) + "] " + t : t;
  }).filter(Boolean).join(withTs ? "\n" : " ");
  return {
    videoId: id, title: (data && data.title) || "", author: (data && data.author_name) || "",
    language: (data && data.language) || "", ok: !!text, text,
  };
}
async function viaTranscriptApi(ids, withTs, debug, lang) {
  const key = process.env.TRANSCRIPTAPI_KEY;
  if (!key) return { error: { status: 500, body: { error: "no_transcriptapi_key", message: "Server is missing TRANSCRIPTAPI_KEY (free 100-credit tier, no card)." } } };
  const results = [];
  let hardError = null;
  const CONC = 4;
  const fetchOne = async (id) => {
    const qs = "video_url=" + encodeURIComponent(id) + "&format=json&include_timestamp=true&send_metadata=true"
      + (lang ? "&language=" + encodeURIComponent(lang + ",asr") : "");
    // AbortSignal timeout is a backstop, same reasoning as viaApify: never let one
    // slow/stuck provider call eat the whole request's 60s budget.
    return fetch("https://transcriptapi.com/api/v2/youtube/transcript?" + qs, {
      headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(15000),
    });
  };
  for (let i = 0; i < ids.length && !hardError; i += CONC) {
    const group = ids.slice(i, i + CONC);
    const settled = await Promise.all(group.map(async (id) => {
      let r;
      try { r = await fetchOne(id); }
      catch (e) { return { videoId: id, title: "", author: "", ok: false, text: "", reason: (e && e.name === "TimeoutError") ? "timed out" : String(e.message || e) }; }
      if (r.status === 401 || r.status === 402) { hardError = { status: r.status, body: { error: "transcriptapi_error", status: r.status } }; return null; }
      // 408/429 are documented as retryable; one retry after their stated backoff window.
      if (r.status === 408 || r.status === 429) {
        await new Promise((z) => setTimeout(z, 2200));
        try { r = await fetchOne(id); } catch { /* keep the original response for the reason below */ }
      }
      const data = await r.json().catch(() => null);
      if (!r.ok) return { videoId: id, title: "", author: "", ok: false, text: "", reason: (data && data.detail) || `provider HTTP ${r.status}` };
      return normalizeTranscriptApi(id, data, withTs);
    }));
    settled.forEach((x) => { if (x) results.push(x); });
  }
  if (hardError && !results.some((t) => t.ok)) return { error: hardError };
  const byId = {}; results.forEach((t) => { byId[t.videoId] = t; });
  return { transcripts: ids.map((id) => byId[id] || { videoId: id, title: "", author: "", ok: false, text: "" }) };
}

/* ---------- title/author enrichment via YouTube oEmbed (free, no key) ---------- */
async function enrichTitles(transcripts) {
  const missing = transcripts.filter((t) => t.ok && !t.title);
  if (!missing.length) return;
  const CONC = 5;
  for (let i = 0; i < missing.length; i += CONC) {
    await Promise.all(missing.slice(i, i + CONC).map(async (t) => {
      try {
        const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + t.videoId));
        if (!r.ok) return;
        const d = await r.json().catch(() => null);
        if (d) { t.title = d.title || t.title; t.author = t.author || d.author_name || ""; }
      } catch { /* non-fatal */ }
    }));
  }
}

/* ---------- provider: youtube-transcript.io (paid) ---------- */
function pickTrack(item) {
  const tracks = item.tracks || item.transcripts || [];
  if (!Array.isArray(tracks) || !tracks.length) return null;
  const score = (t) => { const l = (t.language || t.languageCode || "").toLowerCase(); return (l.includes("en") ? 2 : 0) + (/auto/.test(l) ? 0 : 1); };
  return tracks.slice().sort((a, b) => score(b) - score(a))[0];
}
function normalizeYtio(data, withTs) {
  let list = Array.isArray(data) ? data : (data && (data.transcripts || data.results)) || (data && typeof data === "object" ? Object.values(data) : []);
  return list.filter((x) => x && typeof x === "object").map((item) => {
    const id = item.id || item.videoId || "";
    const track = pickTrack(item);
    const segs = (track && (track.transcript || track.segments || track.cues)) || [];
    const text = withTs
      ? segs.map((s) => "[" + hms(s.start ?? s.offset ?? 0) + "] " + String(s.text || "").replace(/\s+/g, " ").trim()).join("\n")
      : segs.map((s) => String(s.text || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
    return { videoId: id, title: item.title || "", author: item.author || "", language: track ? (track.language || "") : "", ok: segs.length > 0, text };
  });
}
async function viaYtio(ids, withTs, debug) {
  const token = process.env.YT_TRANSCRIPT_TOKEN;
  if (!token) return { error: { status: 500, body: { error: "no_ytio_token", message: "Server is missing YT_TRANSCRIPT_TOKEN." } } };
  const r = await fetch(YTIO_BASE + "/transcripts", {
    method: "POST", headers: { Authorization: "Basic " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (r.status === 429) return { error: { status: 429, body: { error: "rate_limited", retryAfter: Number(r.headers.get("retry-after")) || 10 } } };
  const data = await r.json().catch(() => null);
  if (!r.ok) return { error: { status: r.status, body: { error: "upstream_error", status: r.status, detail: data } } };
  const out = { transcripts: normalizeYtio(data, withTs) };
  if (debug) out.raw = data;
  return out;
}

/* ---------- mock ---------- */
function mock(ids, withTs) {
  const demo = "So the first thing to understand about container shipping is that the ship is almost never the bottleneck. The port is. A modern vessel carries twenty thousand boxes, but if the cranes only move thirty an hour, you are stuck.";
  const segs = [[0, "So the first thing to understand about container shipping"], [6.2, "is that the ship is almost never the bottleneck. The port is."], [12.8, "A modern vessel carries twenty thousand boxes,"], [17.1, "but if the cranes only move thirty an hour, you are stuck."]];
  return (ids.length ? ids : ["jNQXAC9IVRw"]).map((id, i) => ({
    videoId: id, title: "Sample video " + (i + 1), author: "Demo Channel", language: "English", ok: true,
    text: withTs ? segs.map((s) => "[" + hms(s[0]) + "] " + s[1]).join("\n") : demo,
  }));
}

const PROVIDERS = { apify: viaApify, supadata: viaSupadata, transcriptapi: viaTranscriptApi, ytio: viaYtio };
function providerChain() {
  const forced = (process.env.TRANSCRIPT_PROVIDER || "").toLowerCase();
  if (forced && PROVIDERS[forced]) return [forced];
  const chain = [];
  if (process.env.APIFY_TOKEN) chain.push("apify");
  if (process.env.SUPADATA_API_KEY) chain.push("supadata");
  if (process.env.TRANSCRIPTAPI_KEY) chain.push("transcriptapi");
  if (process.env.YT_TRANSCRIPT_TOKEN) chain.push("ytio");
  return chain;
}

function presentTranscript(transcript, withTs) {
  if (!transcript) return transcript;
  return {
    ...transcript,
    title: decodeCaptionText(transcript.title),
    author: decodeCaptionText(transcript.author),
    text: decodeCaptionText(withTs ? String(transcript.text || "") : stripTimestamps(transcript.text)),
  };
}

function unavailableTranscript(videoId, reason) {
  return {
    videoId,
    title: "",
    author: "",
    ok: false,
    text: "",
    reason: reason || "transcript unavailable",
  };
}

function mergeTranscripts(list, cached, fresh, withTs, fallbackReason) {
  const freshById = new Map((fresh || []).map((item) => [item.videoId, item]));
  return list.map((videoId) => presentTranscript(
    cached.get(videoId) || freshById.get(videoId) || unavailableTranscript(videoId, fallbackReason),
    withTs,
  ));
}

/** Programmatic entry used by /api/chapterize and the HTTP handler.
 *
 * Cache entries are canonical timestamped transcripts. A clean-text request is
 * derived from that canonical copy, so asking for the other display format never
 * spends a second provider credit for the same video and language. */
async function fetchTranscripts({ ids, timestamps, debug, lang, mock: useMock }) {
  const list = Array.isArray(ids) ? ids.slice(0, 50) : [];
  const withTs = !!timestamps;
  if (useMock) return { ok: true, transcripts: mock(list, withTs), provider: "mock" };
  if (!list.length) return { ok: false, status: 400, body: { error: "Provide an 'ids' array of YouTube video IDs (max 50)." } };

  const preferredLang = normalizeLanguage(lang);
  // Debug calls intentionally bypass the cache so provider diagnostics describe
  // the provider, not an old successful response.
  const cached = debug ? new Map() : await readCachedTranscripts(list, preferredLang);
  const missing = [...new Set(list.filter((videoId) => !cached.has(videoId)))];
  const cacheMeta = {
    layer: "vercel-runtime",
    ttlDays: 30,
    hits: list.filter((videoId) => cached.has(videoId)).length,
    misses: missing.length,
    writes: 0,
  };

  if (!missing.length) {
    return {
      ok: true,
      transcripts: mergeTranscripts(list, cached, [], withTs),
      provider: "cache",
      cache: cacheMeta,
    };
  }

  const chain = providerChain();
  if (!chain.length) {
    if (cached.size) {
      return {
        ok: true,
        transcripts: mergeTranscripts(list, cached, [], withTs, "not cached and no provider configured"),
        provider: "cache",
        cache: cacheMeta,
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "no_provider", message: "No transcript backend configured. Set APIFY_TOKEN or SUPADATA_API_KEY (both free) or YT_TRANSCRIPT_TOKEN." },
    };
  }

  let lastError = null;
  const attempted = [];
  for (const name of chain) {
    const isLast = name === chain[chain.length - 1];
    try {
      // Always obtain the timestamped form. Clean text is derived locally, so
      // there is exactly one provider/cache entry per video and language.
      const result = await PROVIDERS[name](missing, true, debug, preferredLang);
      if (!result.error) {
        // A provider can answer with no top-level error yet every single video
        // still failed (e.g. Supadata returning a per-video 429, which is not
        // classified as a hard error). Treating that as "this provider succeeded"
        // stranded every later provider in the chain unreachable, confirmed live
        // 2026-08: transcriptapi never got a chance to run because Supadata's
        // all-fail batch looked identical to a real success. Fall through instead,
        // unless this is the last provider, since there is nothing left to try.
        const anyOk = (result.transcripts || []).some((t) => t.ok);
        if (anyOk || isLast) {
          result.provider = name;
          if (attempted.length) result.fellBackFrom = attempted;
          await enrichTitles(result.transcripts);
          cacheMeta.writes = debug ? 0 : await writeCachedTranscripts(
            (result.transcripts || []).filter((transcript) => transcript.ok),
            preferredLang,
          );
          return {
            ok: true,
            ...result,
            transcripts: mergeTranscripts(list, cached, result.transcripts, withTs),
            cache: cacheMeta,
          };
        }
        lastError = { status: 502, body: { error: "empty_batch", provider: name, detail: (result.transcripts || []).map((t) => t.reason).filter(Boolean) } };
        attempted.push(name);
        continue;
      }
      lastError = result.error;
      attempted.push(name);
    } catch (e) {
      lastError = { status: 502, body: { error: "fetch_failed", provider: name, detail: String(e && e.message || e) } };
      attempted.push(name);
    }
  }
  if (cached.size) {
    return {
      ok: true,
      transcripts: mergeTranscripts(
        list,
        cached,
        [],
        withTs,
        (lastError && lastError.body && lastError.body.error) || "provider failed",
      ),
      provider: "cache",
      cache: cacheMeta,
      providerError: lastError && lastError.body,
    };
  }
  lastError = lastError || { status: 502, body: { error: "transcript_failed" } };
  lastError.body.attempted = attempted;
  return { ok: false, status: lastError.status, body: lastError.body };
}

// This endpoint has to be reachable cross-origin: the Chrome extension's content
// script calls it from a youtube.com tab, not from youchop.app. Chrome extension
// host_permissions are meant to exempt such calls from CORS, but that exemption is
// not something to rely on blind: with no Access-Control-Allow-Origin header at
// all, and OPTIONS previously falling through to the 405 below, any fetch that
// wasn't exempted for whatever reason (a browser difference, a permission that
// didn't take, anything) failed outright with "Failed to fetch" before the request
// body was ever read. Nothing here is user-specific or credentialed, so a public
// endpoint answering any origin closes that gap rather than guessing whose fetch
// implementation honors the extension exemption.
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = await readJson(req);
  const result = await fetchTranscripts({
    ids: body.ids,
    timestamps: body.timestamps,
    debug: body.debug,
    lang: body.lang,
    mock: body.mock,
  });
  if (!result.ok) return res.status(result.status).json(result.body);
  const { ok, status, body: _b, ...payload } = result;
  return res.status(200).json(payload);
};
module.exports.fetchTranscripts = fetchTranscripts;
module.exports.parseVideoId = vidFromUrl;
module.exports.hms = hms;
