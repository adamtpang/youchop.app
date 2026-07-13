// GET /api/channel-search?q=veritasium   (or an @handle / channel URL / UC… id)
// Free channel search via YouTube Data API v3 (YT_DATA_API_KEY). Returns candidate
// channels for the picker. search.list costs 100 quota units; handle/id resolution
// costs 1. Free quota is 10,000 units/day.

const BASE = "https://www.googleapis.com/youtube/v3";

function classify(input) {
  let s = String(input || "").trim();
  if (!s) return null;
  if (s.includes("youtube.com") || s.includes("youtu.be")) {
    try {
      const u = new URL(s.startsWith("http") ? s : "https://" + s);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0]) {
        if (parts[0].startsWith("@")) return { kind: "handle", value: parts[0].slice(1) };
        if (parts[0] === "channel" && parts[1]) return { kind: "id", value: parts[1] };
        if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return { kind: "handle", value: parts[1] };
        return { kind: "handle", value: parts[0].replace(/^@/, "") };
      }
    } catch { /* fall through */ }
  }
  if (s.startsWith("@")) return { kind: "handle", value: s.slice(1) };
  if (/^UC[\w-]{22}$/.test(s)) return { kind: "id", value: s };
  return { kind: "search", value: s };
}

function thumb(sn) {
  const t = (sn && sn.thumbnails) || {};
  return (t.default && t.default.url) || (t.medium && t.medium.url) || "";
}

function sample(q) {
  return { candidates: [
    { channelId: "UCdemo0000000000000001", title: q + " (demo result)", description: "Sample channel — real results need a free YouTube Data API key.", thumb: "" },
    { channelId: "UCdemo0000000000000002", title: q + " Clips", description: "Another sample channel.", thumb: "" },
  ], mock: true };
}

module.exports = async (req, res) => {
  const q = (req.query && (req.query.q || req.query.handle || req.query.channel)) || "";
  const c = classify(q);
  if (!c) return res.status(400).json({ error: "Provide ?q= a channel name, @handle, or URL." });
  if (req.query && (req.query.mock === "1" || req.query.mock === true)) return res.status(200).json(sample(c.value));

  const key = process.env.YT_DATA_API_KEY;
  if (!key) return res.status(500).json({ error: "no_data_key", message: "Server is missing YT_DATA_API_KEY (free YouTube Data API key)." });

  try {
    let url;
    if (c.kind === "id") url = `${BASE}/channels?part=snippet&id=${encodeURIComponent(c.value)}&key=${key}`;
    else if (c.kind === "handle") url = `${BASE}/channels?part=snippet&forHandle=${encodeURIComponent(c.value)}&key=${key}`;
    else url = `${BASE}/search?part=snippet&type=channel&maxResults=6&q=${encodeURIComponent(c.value)}&key=${key}`;

    let r = await fetch(url);
    let d = await r.json().catch(() => null);
    // handle -> if forHandle finds nothing, fall back to search
    if (c.kind === "handle" && (!d || !d.items || !d.items.length)) {
      r = await fetch(`${BASE}/search?part=snippet&type=channel&maxResults=6&q=${encodeURIComponent(c.value)}&key=${key}`);
      d = await r.json().catch(() => null);
    }
    if (!r.ok) {
      const reason = d && d.error && d.error.errors && d.error.errors[0] && d.error.errors[0].reason;
      if (reason === "quotaExceeded") return res.status(429).json({ error: "quota_exceeded", message: "YouTube Data API daily quota exhausted (resets midnight Pacific)." });
      return res.status(r.status).json({ error: "data_api_error", detail: d && d.error });
    }
    const candidates = (d.items || []).map((it) => {
      const id = (it.id && it.id.channelId) || it.id; // search vs channels shape
      const sn = it.snippet || {};
      return { channelId: typeof id === "string" ? id : (id && id.channelId) || "", title: sn.channelTitle || sn.title || "", description: sn.description || "", thumb: thumb(sn) };
    }).filter((x) => x.channelId);
    return res.status(200).json({ candidates });
  } catch (e) {
    return res.status(502).json({ error: "fetch_failed", detail: String(e && e.message || e) });
  }
};
