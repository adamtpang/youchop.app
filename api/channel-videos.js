// GET /api/channel-videos?channelId=UC…   (or ?handle=@name / ?url=… )
//
// Lists a channel's uploads. The default path needs NO key and no signup: it calls
// the same public innertube endpoint youtube.com's own front end uses, which is
// what yt-dlp does too. Only public metadata (id, title, length) is read; this is
// listing, not the player, so it is not behind the PoToken bot gate that blocks
// caption fetches from datacenter IPs.
//
// YT_DATA_API_KEY remains an OPTIONAL fallback. If innertube's response shape
// changes, a key (if one is configured) keeps the feature alive rather than
// returning nothing. Neither is required for the site to work.

const BASE = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = 2000; // hard cap so a giant channel can't run away
const VIDEOS_TAB = "EgZ2aWRlb3PyBgQKAjoA"; // browse params selecting a channel's Videos tab
// Vercel kills a Hobby function at 10s. Stay under it so a large channel returns a
// partial, labelled list instead of a 504 with nothing in it.
const BUDGET_MS = Number(process.env.CHANNEL_LIST_BUDGET_MS || 8000);

// The web client key is a public constant embedded in youtube.com's own JavaScript.
// It identifies the client, it is not a credential and grants no private access.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const CLIENT = { clientName: "WEB", clientVersion: "2.20250401.01.00" };
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

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

/* ---------------- keyless path ---------------- */

async function innertube(body) {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${INNERTUBE_KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    body: JSON.stringify({ context: { client: CLIENT }, ...body }),
  });
  if (!r.ok) throw new Error(`innertube HTTP ${r.status}`);
  return r.json();
}

// A channel page carries its own canonical UC… id and display name. Handles change,
// ids do not, so always read both off the page rather than echoing back the input.
async function channelMeta(inp) {
  const path = inp.kind === "id" ? `channel/${inp.value}` : `@${encodeURIComponent(inp.value)}`;
  const r = await fetch(`https://www.youtube.com/${path}/videos`, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
  });
  if (!r.ok) throw new Error(`channel page HTTP ${r.status}`);
  const html = await r.text();
  const m =
    html.match(/"browseId":"(UC[\w-]{22})"/) ||
    html.match(/"externalId":"(UC[\w-]{22})"/) ||
    html.match(/channel\/(UC[\w-]{22})/);
  if (!m) throw new Error("no channel id on page");
  const t = html.match(/<meta property="og:title" content="([^"]*)"/);
  return { id: m[1], title: t ? decodeEntities(t[1]) : inp.value };
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const CLOCK = /^\d{1,3}:\d{2}(?::\d{2})?$/;

function clockToSeconds(s) {
  const p = String(s).split(":").map(Number);
  if (p.some(isNaN)) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : null;
}

// Find the first string value under `node` that satisfies `test`, at any depth.
// Used for duration and publish date, whose exact nesting YouTube keeps rearranging.
function findText(node, test, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findText(n, test, depth + 1); if (r) return r; }
    return null;
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (typeof v === "string") { if (test(v)) return v; }
    else { const r = findText(v, test, depth + 1); if (r) return r; }
  }
  return null;
}

// Walk any nested structure and pull out every video, plus the continuation token.
// Two shapes are handled: `lockupViewModel`, which is what YouTube actually returns
// now, and the older `playlistVideoRenderer`/`videoRenderer`. Reading by shape rather
// than by a fixed path means a layout tweak does not break listing.
function harvest(node, out, state) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) harvest(n, out, state); return; }

  const lk = node.lockupViewModel;
  if (lk && lk.contentId && /VIDEO/.test(lk.contentType || "") && !out.seen.has(lk.contentId)) {
    out.seen.add(lk.contentId);
    const dur = findText(lk.contentImage, (s) => CLOCK.test(s));
    out.videos.push({
      videoId: lk.contentId,
      title: lk.metadata?.lockupMetadataViewModel?.title?.content || "",
      seconds: dur ? clockToSeconds(dur) : null,
      published: findText(lk.metadata, (s) => /\bago\b/.test(s) || /^\w{3} \d{1,2}, \d{4}$/.test(s)),
    });
  }

  const v = node.playlistVideoRenderer || node.videoRenderer;
  if (v && v.videoId && !out.seen.has(v.videoId)) {
    out.seen.add(v.videoId);
    out.videos.push({
      videoId: v.videoId,
      title: v.title?.simpleText || (v.title?.runs || []).map((r) => r.text).join("") || "",
      seconds: v.lengthSeconds ? Number(v.lengthSeconds) : null,
      published: (v.videoInfo?.runs || []).map((r) => r.text).join("") || null,
    });
  }

  // Keep the FIRST continuation token, not the last. A page can carry more than one
  // (the grid's, plus one belonging to a side shelf), and following the last one
  // dead-ends after a single page. Taking the first walks the whole channel.
  const c = node.continuationItemRenderer;
  if (c?.continuationEndpoint?.continuationCommand && !state.token) {
    state.token = c.continuationEndpoint.continuationCommand.token;
  }
  for (const k of Object.keys(node)) harvest(node[k], out, state);
}

async function listKeyless(inp) {
  // Resolve for both handles and ids: an id alone gives no display name, and
  // echoing the raw UC… string back put a channel id in the page header.
  const { id, title } = await channelMeta(inp);

  const out = { videos: [], seen: new Set() };
  let token = "", truncated = false, reason = "", pages = 0;

  // Walk the channel's Videos tab. The uploads playlist (VL+UU…) lists videos too,
  // but its continuation dead-ends after two pages. Measured on Y Combinator: 641
  // videos over 22 pages here, versus 200 there.
  const start = Date.now();
  do {
    const state = { token: "" };
    const data = await innertube(
      token ? { continuation: token } : { browseId: id, params: VIDEOS_TAB }
    );
    harvest(data, out, state);
    token = state.token;
    if (out.videos.length >= MAX_VIDEOS) { truncated = true; reason = "cap"; break; }
    if (++pages > 150) { truncated = true; reason = "cap"; break; }
    // A serverless function is killed at its timeout, which would turn a large
    // channel into an opaque 504. Stop early and say so instead.
    if (Date.now() - start > BUDGET_MS) { truncated = true; reason = "time"; break; }
  } while (token);

  if (!out.videos.length) throw new Error("no videos parsed");

  return {
    channel: { title, id },
    videos: out.videos,
    truncated,
    via: "keyless",
    note: truncated
      ? (reason === "time"
          ? `This channel is large, so listing stopped at ${out.videos.length} videos to stay inside the request time budget. Use Paste video links to reach older ones.`
          : `Listing stopped at ${out.videos.length} videos, the per-request maximum.`)
      : null,
  };
}

/* ---------------- optional Data API fallback ---------------- */

async function listWithKey(inp, key) {
  const chUrl = inp.kind === "id"
    ? `${BASE}/channels?part=snippet,contentDetails&id=${encodeURIComponent(inp.value)}&key=${key}`
    : `${BASE}/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(inp.value)}&key=${key}`;
  const cr = await fetch(chUrl);
  const cd = await cr.json().catch(() => null);
  if (!cr.ok) {
    const reason = cd?.error?.errors?.[0]?.reason;
    const err = new Error(reason === "quotaExceeded" ? "quota_exceeded" : "data_api_error");
    err.status = reason === "quotaExceeded" ? 429 : cr.status;
    err.detail = cd && cd.error;
    throw err;
  }
  const ch = cd.items && cd.items[0];
  if (!ch) { const e = new Error("channel_not_found"); e.status = 404; throw e; }
  const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) { const e = new Error("no_uploads"); e.status = 404; throw e; }

  const videos = [];
  let pageToken = "", truncated = false;
  do {
    const purl = `${BASE}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${uploads}${pageToken ? "&pageToken=" + pageToken : ""}&key=${key}`;
    const pr = await fetch(purl);
    const pd = await pr.json().catch(() => null);
    if (!pr.ok) break;
    (pd.items || []).forEach((it) => {
      const vid = it.contentDetails && it.contentDetails.videoId;
      if (vid) videos.push({
        videoId: vid,
        title: it.snippet?.title || "",
        seconds: null,
        published: it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || null,
      });
    });
    pageToken = pd.nextPageToken || "";
    if (videos.length >= MAX_VIDEOS) { truncated = true; break; }
  } while (pageToken);

  return { channel: { title: ch.snippet?.title || inp.value, id: ch.id }, videos, truncated, via: "data-api" };
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const inp = resolveInput(q);
  if (!inp) return res.status(400).json({ error: "Provide ?channelId=UC…, ?handle=@name, or ?url=…" });

  let firstError = null;
  try {
    return res.status(200).json(await listKeyless(inp));
  } catch (e) {
    firstError = String((e && e.message) || e);
  }

  const key = process.env.YT_DATA_API_KEY;
  if (key) {
    try {
      return res.status(200).json(await listWithKey(inp, key));
    } catch (e) {
      return res.status(e.status || 502).json({
        error: e.message || "lookup_failed",
        message: "Both the keyless listing and the YouTube Data API failed.",
        keylessError: firstError,
        detail: e.detail,
      });
    }
  }

  return res.status(502).json({
    error: "lookup_failed",
    message:
      "Could not list that channel. Check the @handle or paste the full channel URL. " +
      "If this keeps happening, YouTube may have changed its listing format.",
    keylessError: firstError,
  });
};
