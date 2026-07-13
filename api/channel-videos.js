// GET /api/channel-videos?channelId=UC…   (or ?handle=@name / ?url=… )
// Lists a channel's uploads via the free YouTube Data API v3 (YT_DATA_API_KEY).
// channels.list -> uploads playlist -> playlistItems.list (paginated). ~1 unit per
// 50 videos, so a 1,000-video channel costs ~20 units of the 10,000/day free quota.

const BASE = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = 2000; // hard cap so a giant channel can't run away

function resolveInput(q) {
  let s = String(q.channelId || q.handle || q.url || q.channel || q.id || "").trim();
  if (!s) return null;
  if (s.includes("youtube.com") || s.includes("youtu.be")) {
    try {
      const u = new URL(s.startsWith("http") ? s : "https://" + s);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0]) {
        if (parts[0].startsWith("@")) return { kind: "handle", value: parts[0].slice(1) };
        if (parts[0] === "channel" && parts[1]) return { kind: "id", value: parts[1] };
        if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return { kind: "handle", value: parts[1] };
      }
    } catch { /* ignore */ }
  }
  if (/^UC[\w-]{22}$/.test(s)) return { kind: "id", value: s };
  return { kind: "handle", value: s.replace(/^@/, "") };
}

function sample(label) {
  const vids = Array.from({ length: 12 }, (_, i) => ({
    videoId: "vid" + String(i).padStart(2, "0") + "demo0",
    title: ["How container ports actually work", "The economics of undersea cables", "Why chip fabs cost $20 billion",
      "Inside an air traffic control tower", "The hidden logistics of grocery stores", "How high-speed rail is funded",
      "What breaks when a power grid fails", "The math of vaccine cold chains", "Why bridges are so expensive",
      "The truth about water treatment", "How GPS actually works", "The physics of skyscrapers"][i],
    published: "2026-0" + ((i % 9) + 1) + "-01",
  }));
  return { channel: { title: label + " (demo)", id: "UCdemo" }, videos: vids, mock: true };
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const inp = resolveInput(q);
  if (!inp) return res.status(400).json({ error: "Provide ?channelId=UC…, ?handle=@name, or ?url=…" });
  if (q.mock === "1" || q.mock === true) return res.status(200).json(sample(inp.value));

  const key = process.env.YT_DATA_API_KEY;
  if (!key) return res.status(500).json({ error: "no_data_key", message: "Server is missing YT_DATA_API_KEY (free YouTube Data API key)." });

  try {
    // 1) resolve channel -> uploads playlist + title
    let chUrl = inp.kind === "id"
      ? `${BASE}/channels?part=snippet,contentDetails&id=${encodeURIComponent(inp.value)}&key=${key}`
      : `${BASE}/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(inp.value)}&key=${key}`;
    let cr = await fetch(chUrl);
    let cd = await cr.json().catch(() => null);
    if (!cr.ok) {
      const reason = cd && cd.error && cd.error.errors && cd.error.errors[0] && cd.error.errors[0].reason;
      if (reason === "quotaExceeded") return res.status(429).json({ error: "quota_exceeded", message: "YouTube Data API daily quota exhausted." });
      return res.status(cr.status).json({ error: "data_api_error", detail: cd && cd.error });
    }
    const ch = cd.items && cd.items[0];
    if (!ch) return res.status(404).json({ error: "channel_not_found", message: "No channel matched. Try the exact @handle or channel URL." });
    const uploads = ch.contentDetails && ch.contentDetails.relatedPlaylists && ch.contentDetails.relatedPlaylists.uploads;
    if (!uploads) return res.status(404).json({ error: "no_uploads", message: "Channel has no uploads playlist." });

    // 2) page through uploads
    const videos = [];
    let pageToken = "", truncated = false;
    do {
      const purl = `${BASE}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${uploads}${pageToken ? "&pageToken=" + pageToken : ""}&key=${key}`;
      const pr = await fetch(purl);
      const pd = await pr.json().catch(() => null);
      if (!pr.ok) {
        const reason = pd && pd.error && pd.error.errors && pd.error.errors[0] && pd.error.errors[0].reason;
        if (reason === "quotaExceeded") return res.status(429).json({ error: "quota_exceeded", message: "Quota hit mid-listing.", partial: videos });
        break;
      }
      (pd.items || []).forEach((it) => {
        const vid = it.contentDetails && it.contentDetails.videoId;
        if (vid) videos.push({ videoId: vid, title: (it.snippet && it.snippet.title) || "", published: (it.contentDetails && it.contentDetails.videoPublishedAt) || (it.snippet && it.snippet.publishedAt) || null });
      });
      pageToken = pd.nextPageToken || "";
      if (videos.length >= MAX_VIDEOS) { truncated = true; break; }
    } while (pageToken);

    return res.status(200).json({
      channel: { title: (ch.snippet && ch.snippet.title) || inp.value, id: ch.id },
      videos, truncated,
    });
  } catch (e) {
    return res.status(502).json({ error: "fetch_failed", detail: String(e && e.message || e) });
  }
};
