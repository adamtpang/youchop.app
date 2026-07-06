// POST /api/transcripts  { ids: [videoId, ...], timestamps?: bool, mock?: bool }
// Proxies youtube-transcript.io so the API token never reaches the browser.
// Docs: https://www.youtube-transcript.io/api  (Authorization: Basic <token>, <=50 ids/call)

const BASE = "https://www.youtube-transcript.io/api";

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

// The transcripts endpoint returns, per video, an object shaped roughly like:
// { id, title, author, channelId, tracks: [{ language, transcript: [{text,start,dur}] }], ... }
// We stay defensive about that shape.
function pickTrack(item) {
  const tracks = item.tracks || item.transcripts || [];
  if (!Array.isArray(tracks) || !tracks.length) return null;
  // prefer a manual (non "auto-generated") English track, else first
  const score = (t) => {
    const lang = (t.language || t.languageCode || "").toLowerCase();
    let s = 0;
    if (lang.includes("en")) s += 2;
    if (!/auto/.test(lang)) s += 1;
    return s;
  };
  return tracks.slice().sort((a, b) => score(b) - score(a))[0];
}

function segmentsOf(track) {
  if (!track) return [];
  const segs = track.transcript || track.segments || track.cues || [];
  return Array.isArray(segs) ? segs : [];
}

function hms(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = (h ? String(m).padStart(2, "0") : String(m));
  return (h ? h + ":" : "") + mm + ":" + String(s).padStart(2, "0");
}

function normalizeItem(item, withTimestamps) {
  const id = item.id || item.videoId || item.video_id || "";
  const track = pickTrack(item);
  const segs = segmentsOf(track);
  let text;
  if (withTimestamps) {
    text = segs.map((sg) => "[" + hms(sg.start ?? sg.offset ?? 0) + "] " + String(sg.text || "").replace(/\s+/g, " ").trim()).join("\n");
  } else {
    text = segs.map((sg) => String(sg.text || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
  }
  return {
    videoId: id,
    title: item.title || (item.microformat && item.microformat.title) || "",
    author: item.author || item.channel || "",
    language: track ? (track.language || track.languageCode || "") : "",
    ok: segs.length > 0,
    text: text,
  };
}

function normalize(data, withTimestamps) {
  // data may be an array, or an object keyed by id, or { transcripts: [...] }
  let list = [];
  if (Array.isArray(data)) list = data;
  else if (data && Array.isArray(data.transcripts)) list = data.transcripts;
  else if (data && Array.isArray(data.results)) list = data.results;
  else if (data && typeof data === "object") list = Object.values(data).filter((v) => v && typeof v === "object");
  return list.map((it) => normalizeItem(it, withTimestamps));
}

function sample(ids, withTimestamps) {
  const demo = "So the first thing you have to understand about container shipping is that the ship is almost never the bottleneck. The port is. " +
    "A modern vessel can carry twenty thousand boxes, but if the cranes can only move thirty an hour, you are stuck. " +
    "That single constraint explains almost everything about global logistics.";
  const segs = [
    { start: 0, text: "So the first thing you have to understand about container shipping" },
    { start: 6.2, text: "is that the ship is almost never the bottleneck. The port is." },
    { start: 12.8, text: "A modern vessel can carry twenty thousand boxes," },
    { start: 17.1, text: "but if the cranes can only move thirty an hour, you are stuck." },
    { start: 23.0, text: "That single constraint explains almost everything about global logistics." },
  ];
  return (ids && ids.length ? ids : ["jNQXAC9IVRw"]).map((id, i) => ({
    videoId: id,
    title: "Sample video " + (i + 1) + " — how ports really work",
    author: "Demo Channel",
    language: "English",
    ok: true,
    text: withTimestamps ? segs.map((s) => "[" + hms(s.start) + "] " + s.text).join("\n") : demo,
  }));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 50) : [];
  const withTimestamps = !!body.timestamps;

  if (body.mock) return res.status(200).json({ transcripts: sample(ids, withTimestamps), mock: true });
  if (!ids.length) return res.status(400).json({ error: "Provide an 'ids' array of YouTube video IDs (max 50)." });

  const token = process.env.YT_TRANSCRIPT_TOKEN;
  if (!token) return res.status(500).json({ error: "Server is missing YT_TRANSCRIPT_TOKEN. Set it in the Vercel project env." });

  try {
    const upstream = await fetch(BASE + "/transcripts", {
      method: "POST",
      headers: { Authorization: "Basic " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (upstream.status === 429) {
      const ra = Number(upstream.headers.get("retry-after")) || 10;
      return res.status(429).json({ error: "rate_limited", retryAfter: ra });
    }
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) return res.status(upstream.status).json({ error: "upstream_error", status: upstream.status, detail: data });
    if (body.debug) return res.status(200).json({ transcripts: normalize(data, withTimestamps), raw: data });
    return res.status(200).json({ transcripts: normalize(data, withTimestamps) });
  } catch (e) {
    return res.status(502).json({ error: "fetch_failed", detail: String(e && e.message || e) });
  }
};
