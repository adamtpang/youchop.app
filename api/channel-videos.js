// GET  /api/channel-videos?handle=@jawed[&mock=1][&debug=1]
// POST /api/channel-videos { handle, mock?, debug? }
// Resolves a YouTube channel to its videos via youtube-transcript.io /api/channels
// (Plus tier and above). Response shape isn't publicly documented, so we normalize
// defensively and expose ?debug=1 to inspect the raw payload.

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

// Accept a raw handle, @handle, a full channel URL, or a UC… channel id.
function parseHandle(input) {
  if (!input) return null;
  let s = String(input).trim();
  if (s.includes("youtube.com") || s.includes("youtu.be")) {
    try {
      const u = new URL(s.startsWith("http") ? s : "https://" + s);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0]) {
        if (parts[0].startsWith("@")) return parts[0].slice(1);
        if ((parts[0] === "channel" || parts[0] === "c" || parts[0] === "user") && parts[1]) return parts[1];
        return parts[0].replace(/^@/, "");
      }
    } catch { /* fall through */ }
  }
  return s.replace(/^@/, "");
}

const VIDEO_KEYS = ["id", "videoId", "video_id", "videoID"];

function normalizeVideos(data) {
  const out = [];
  const seen = new Set();
  const looksLikeVideo = (o) => {
    if (!o || typeof o !== "object") return false;
    const idKey = VIDEO_KEYS.find((k) => typeof o[k] === "string" && /^[\w-]{8,20}$/.test(o[k]));
    if (!idKey) return false;
    // an 11-char YouTube id, or accompanied by a title/duration
    return o[idKey].length === 11 || o.title || o.name || o.duration || o.lengthSeconds || o.publishedTimeText;
  };
  const push = (o) => {
    const idKey = VIDEO_KEYS.find((k) => typeof o[k] === "string");
    const id = o[idKey];
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      videoId: id,
      title: o.title || o.name || "",
      published: o.published || o.publishedAt || o.publishedTimeText || o.date || null,
      duration: o.duration || o.lengthText || o.lengthSeconds || null,
    });
  };
  const walk = (node, depth) => {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    if (typeof node === "object") {
      if (looksLikeVideo(node)) push(node);
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (v && typeof v === "object") walk(v, depth + 1);
      }
    }
  };
  walk(data, 0);
  return out;
}

// best-effort channel meta (title/id) for the header
function channelMeta(data, fallback) {
  let title = fallback, id = null;
  const walk = (node, depth) => {
    if (!node || depth > 4 || typeof node !== "object") return;
    if (node.channelTitle || node.channelName || node.author) title = node.channelTitle || node.channelName || node.author || title;
    if (node.channelId || node.channel_id) id = node.channelId || node.channel_id || id;
    for (const k of Object.keys(node)) if (node[k] && typeof node[k] === "object") walk(node[k], depth + 1);
  };
  walk(data, 0);
  return { title, id };
}

function sample(handle) {
  const vids = Array.from({ length: 8 }, (_, i) => ({
    videoId: "vid" + String(i).padStart(2, "0") + "demo0", // 11-char-ish placeholder
    title: [
      "How container ports actually work",
      "The economics of undersea cables",
      "Why chip fabs cost $20 billion",
      "A day inside an air traffic control tower",
      "The hidden logistics of grocery stores",
      "How high-speed rail is really funded",
      "What breaks when a power grid fails",
      "The surprising math of vaccine cold chains",
    ][i],
    published: (i + 1) + " weeks ago",
    duration: (30 + i * 7) + ":00",
  }));
  return { channel: { title: "@" + handle + " (demo)", id: "UCdemo" }, videos: vids, mock: true };
}

module.exports = async (req, res) => {
  const q = req.method === "POST" ? await readJson(req) : (req.query || {});
  const handle = parseHandle(q.handle || q.channel || q.id);
  const mock = q.mock === "1" || q.mock === true;
  const debug = q.debug === "1" || q.debug === true;
  if (!handle) return res.status(400).json({ error: "Provide a channel: ?handle=@name or a channel URL." });

  if (mock) return res.status(200).json(sample(handle));

  const token = process.env.YT_TRANSCRIPT_TOKEN;
  if (!token) return res.status(500).json({ error: "Server is missing YT_TRANSCRIPT_TOKEN. Set it in the Vercel project env." });

  try {
    const upstream = await fetch(BASE + "/channels", {
      method: "POST",
      headers: { Authorization: "Basic " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [handle] }),
    });
    if (upstream.status === 429) {
      const ra = Number(upstream.headers.get("retry-after")) || 10;
      return res.status(429).json({ error: "rate_limited", retryAfter: ra });
    }
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) return res.status(upstream.status).json({ error: "upstream_error", status: upstream.status, detail: data });
    const videos = normalizeVideos(data);
    const meta = channelMeta(data, "@" + handle);
    const payload = { channel: meta, videos };
    if (debug) payload.raw = data;
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(502).json({ error: "fetch_failed", detail: String(e && e.message || e) });
  }
};
