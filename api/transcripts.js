// POST /api/transcripts  { ids: [videoId,...], timestamps?, mock?, debug? }
// Pluggable transcript backends with automatic fallback:
//   TRANSCRIPT_PROVIDER = "apify" | "supadata" | "ytio"  forces one provider;
//   otherwise every configured provider is tried in order apify -> supadata -> ytio
//   (a provider that errors — e.g. monthly credits exhausted — falls through to the next).
//   - apify:    APIFY_TOKEN (free $5/mo credits). Actor runs on Apify's infra, which
//               survives YouTube's datacenter-IP blocking that kills scraping on Vercel.
//               Actor: karamelo/youtube-transcripts (override APIFY_TRANSCRIPT_ACTOR).
//               Verified output shape: { videoId, captions, channelName? } where captions
//               is a string (singleStringText), [{start,end,text}] (textWithTimestamps),
//               or [string] (captions).
//   - supadata: SUPADATA_API_KEY (free 100 transcripts/mo, no card). One request per video:
//               GET api.supadata.ai/v1/transcript?url=…  (x-api-key header).
//   - ytio:     YT_TRANSCRIPT_TOKEN — youtube-transcript.io (paid, optional).
// Batches capped at 50 ids. Mock mode needs no key.

const YTIO_BASE = "https://www.youtube-transcript.io/api";
const APIFY_ACTOR = process.env.APIFY_TRANSCRIPT_ACTOR || "karamelo~youtube-transcripts";

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
  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}`;
  const input = {
    urls: ids.map((id) => "https://www.youtube.com/watch?v=" + id),
    outputFormat: withTs ? "textWithTimestamps" : "singleStringText",
    channelNameBoolean: true,
    maxRetries: 6,
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
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
  if (!data) return { videoId: id, title: "", author: "", ok: false, text: "" };
  let text = "";
  if (typeof data.content === "string") text = data.content.trim();
  else if (Array.isArray(data.content)) {
    text = data.content.map((s) => {
      const t = String(s.text || "").replace(/\s+/g, " ").trim();
      return withTs && s.offset != null ? "[" + hms(Math.floor(Number(s.offset) / 1000)) + "] " + t : t;
    }).filter(Boolean).join(withTs ? "\n" : " ");
  }
  return { videoId: id, title: "", author: "", language: data.lang || "", ok: !!text, text };
}
async function viaSupadata(ids, withTs, debug) {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) return { error: { status: 500, body: { error: "no_supadata_key", message: "Server is missing SUPADATA_API_KEY (free tier)." } } };
  const results = [];
  let hardError = null;
  const CONC = 4;
  for (let i = 0; i < ids.length && !hardError; i += CONC) {
    const group = ids.slice(i, i + CONC);
    const settled = await Promise.all(group.map(async (id) => {
      const qs = "url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id) + (withTs ? "" : "&text=true");
      let r = await fetch("https://api.supadata.ai/v1/transcript?" + qs, { headers: { "x-api-key": key } });
      if (r.status === 429) { // one retry after backoff
        await new Promise((z) => setTimeout(z, 2200));
        r = await fetch("https://api.supadata.ai/v1/transcript?" + qs, { headers: { "x-api-key": key } });
      }
      const data = await r.json().catch(() => null);
      if (r.status === 401 || r.status === 402 || r.status === 403) { hardError = { status: r.status, body: { error: "supadata_error", status: r.status, detail: data } }; return null; }
      if (!r.ok) return { videoId: id, title: "", author: "", ok: false, text: "" };
      return normalizeSupadata(id, data, withTs);
    }));
    settled.forEach((x) => { if (x) results.push(x); });
  }
  if (hardError && !results.some((t) => t.ok)) return { error: hardError };
  const byId = {}; results.forEach((t) => { byId[t.videoId] = t; });
  return { transcripts: ids.map((id) => byId[id] || { videoId: id, title: "", author: "", ok: false, text: "" }) };
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

const PROVIDERS = { apify: viaApify, supadata: viaSupadata, ytio: viaYtio };
function providerChain() {
  const forced = (process.env.TRANSCRIPT_PROVIDER || "").toLowerCase();
  if (forced && PROVIDERS[forced]) return [forced];
  const chain = [];
  if (process.env.APIFY_TOKEN) chain.push("apify");
  if (process.env.SUPADATA_API_KEY) chain.push("supadata");
  if (process.env.YT_TRANSCRIPT_TOKEN) chain.push("ytio");
  return chain;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 50) : [];
  const withTs = !!body.timestamps;

  if (body.mock) return res.status(200).json({ transcripts: mock(ids, withTs), provider: "mock" });
  if (!ids.length) return res.status(400).json({ error: "Provide an 'ids' array of YouTube video IDs (max 50)." });

  const chain = providerChain();
  if (!chain.length) return res.status(500).json({ error: "no_provider", message: "No transcript backend configured. Set APIFY_TOKEN or SUPADATA_API_KEY (both free) or YT_TRANSCRIPT_TOKEN." });

  let lastError = null;
  const attempted = [];
  for (const name of chain) {
    try {
      const result = await PROVIDERS[name](ids, withTs, body.debug);
      if (!result.error) {
        result.provider = name;
        if (attempted.length) result.fellBackFrom = attempted;
        return res.status(200).json(result);
      }
      lastError = result.error;
      attempted.push(name);
    } catch (e) {
      lastError = { status: 502, body: { error: "fetch_failed", provider: name, detail: String(e && e.message || e) } };
      attempted.push(name);
    }
  }
  lastError.body.attempted = attempted;
  return res.status(lastError.status).json(lastError.body);
};
