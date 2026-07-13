// POST /api/transcripts  { ids: [videoId,...], timestamps?, mock?, debug? }
// Pluggable transcript backend. Provider is chosen by env:
//   TRANSCRIPT_PROVIDER = "apify" | "ytio"   (or auto-detected from whichever key exists)
//   - apify: runs a YouTube-transcript Actor on Apify (free tier). Needs APIFY_TOKEN.
//            Actor defaults to karamelo/youtube-transcripts; override APIFY_TRANSCRIPT_ACTOR.
//            Apify runs the scrape on their infra (residential-grade), so it survives
//            YouTube's datacenter-IP blocking that kills direct scraping on Vercel.
//   - ytio: youtube-transcript.io (paid). Needs YT_TRANSCRIPT_TOKEN.
// Batches are capped at 50 ids. Mock mode needs no key.

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
  // try known/likely fields, then fall back to the longest string on the object
  const direct = item.singleStringText || item.transcriptText || item.transcript || item.text || item.captions || item.content;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  // array-of-segments shapes
  const segs = item.transcript || item.captions || item.segments;
  if (Array.isArray(segs)) {
    return segs.map((s) => {
      const t = String(s.text || s.caption || "").replace(/\s+/g, " ").trim();
      return withTs && (s.start != null || s.offset != null) ? "[" + hms(s.start ?? s.offset) + "] " + t : t;
    }).filter(Boolean).join(withTs ? "\n" : " ");
  }
  // last resort: the longest string value on the item
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
    byId[id] = {
      videoId: id,
      title: it.title || it.videoTitle || "",
      author: it.channelName || it.author || it.channel || "",
      language: it.language || "",
      ok: false, text: "",
    };
    const text = extractApifyText(it, withTs);
    byId[id].text = text; byId[id].ok = !!(text && text.length);
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
  if (!r.ok) return { error: { status: r.status === 402 ? 402 : r.status, body: { error: "apify_error", status: r.status, detail: data } } };
  const out = { transcripts: normalizeApify(data, ids, withTs) };
  if (debug) out.raw = data;
  return out;
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

function chooseProvider() {
  const p = (process.env.TRANSCRIPT_PROVIDER || "").toLowerCase();
  if (p) return p;
  if (process.env.APIFY_TOKEN) return "apify";
  if (process.env.YT_TRANSCRIPT_TOKEN) return "ytio";
  return "none";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 50) : [];
  const withTs = !!body.timestamps;

  if (body.mock) return res.status(200).json({ transcripts: mock(ids, withTs), provider: "mock" });
  if (!ids.length) return res.status(400).json({ error: "Provide an 'ids' array of YouTube video IDs (max 50)." });

  const provider = chooseProvider();
  try {
    let result;
    if (provider === "apify") result = await viaApify(ids, withTs, body.debug);
    else if (provider === "ytio") result = await viaYtio(ids, withTs, body.debug);
    else return res.status(500).json({ error: "no_provider", message: "No transcript backend configured. Set APIFY_TOKEN (free) or YT_TRANSCRIPT_TOKEN." });

    if (result.error) return res.status(result.error.status).json(result.error.body);
    result.provider = provider;
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: "fetch_failed", provider, detail: String(e && e.message || e) });
  }
};
