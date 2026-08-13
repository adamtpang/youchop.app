// GET /api/playlist-videos?listId=PL…   (or ?url=https://youtube.com/playlist?list=…)
//
// Lists a playlist's videos. Same keyless approach as channel-videos.js: read the
// playlist page's own embedded ytInitialData for page one (no key, no signup),
// then page forward through innertube's browse continuation, which is the same
// endpoint youtube.com's own front end uses.
//
// YT_DATA_API_KEY remains an OPTIONAL fallback via the official playlistItems
// endpoint, used only if the keyless page-scrape fails.

const BASE = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = 2000; // hard cap so a giant playlist can't run away
// Vercel kills a Hobby function at 10s. Stay under it so a large playlist returns a
// partial, labelled list instead of a 504 with nothing in it.
const BUDGET_MS = Number(process.env.CHANNEL_LIST_BUDGET_MS || 8000);

// The web client key is a public constant embedded in youtube.com's own JavaScript.
// It identifies the client, it is not a credential and grants no private access.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const CLIENT = { clientName: "WEB", clientVersion: "2.20250401.01.00" };
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

function resolvePlaylistId(q) {
  let s = String(q.listId || q.list || q.url || q.playlist || q.id || "").trim();
  if (!s) return null;
  if (s.includes("youtube.com") || s.includes("youtu.be")) {
    try {
      const u = new URL(s.startsWith("http") ? s : "https://" + s);
      const list = u.searchParams.get("list");
      if (list) return list;
    } catch { /* ignore, fall through to raw string below */ }
  }
  return s;
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
// Used for duration, whose exact nesting YouTube keeps rearranging.
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
// than by a fixed path means a layout tweak does not break listing. Same approach as
// channel-videos.js, duplicated rather than shared: two small serverless functions
// with no import between them is simpler than a shared module Vercel has to bundle
// into both anyway.
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

  // Keep the FIRST continuation token, not the last, same reasoning as
  // channel-videos.js: a page can carry more than one continuation.
  const c = node.continuationItemRenderer;
  if (c?.continuationEndpoint?.continuationCommand && !state.token) {
    state.token = c.continuationEndpoint.continuationCommand.token;
  }
  for (const k of Object.keys(node)) harvest(node[k], out, state);
}

async function innertube(body) {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${INNERTUBE_KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    body: JSON.stringify({ context: { client: CLIENT }, ...body }),
  });
  if (!r.ok) throw new Error(`innertube HTTP ${r.status}`);
  return r.json();
}

// Page one comes off the playlist's own page (its embedded ytInitialData), which
// also carries the playlist title. Pages after that come from innertube continuation.
async function playlistPageOne(listId) {
  const r = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
  });
  if (!r.ok) throw new Error(`playlist page HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/var ytInitialData = (\{.+?\});<\/script>/s) ||
            html.match(/window\["ytInitialData"\]\s*=\s*(\{.+?\});<\/script>/s);
  if (!m) throw new Error("no ytInitialData on page");
  let data;
  try { data = JSON.parse(m[1]); } catch { throw new Error("could not parse ytInitialData"); }
  const t = html.match(/<meta property="og:title" content="([^"]*)"/);
  if (!t) throw new Error("playlist not found");
  return { title: decodeEntities(t[1]), data };
}

async function listKeyless(listId) {
  const { title, data } = await playlistPageOne(listId);

  const out = { videos: [], seen: new Set() };
  const first = { token: "" };
  harvest(data, out, first);
  let token = first.token, truncated = false, reason = "", pages = 0;

  const start = Date.now();
  while (token) {
    const state = { token: "" };
    const page = await innertube({ continuation: token });
    harvest(page, out, state);
    token = state.token;
    if (out.videos.length >= MAX_VIDEOS) { truncated = true; reason = "cap"; break; }
    if (++pages > 150) { truncated = true; reason = "cap"; break; }
    // A serverless function is killed at its timeout, which would turn a large
    // playlist into an opaque 504. Stop early and say so instead.
    if (Date.now() - start > BUDGET_MS) { truncated = true; reason = "time"; break; }
  }

  if (!out.videos.length) throw new Error("no videos parsed");

  return {
    playlist: { title, id: listId },
    videos: out.videos,
    truncated,
    via: "keyless",
    note: truncated
      ? (reason === "time"
          ? `This playlist is large, so listing stopped at ${out.videos.length} videos to stay inside the request time budget.`
          : `Listing stopped at ${out.videos.length} videos, the per-request maximum.`)
      : null,
  };
}

/* ---------------- optional Data API fallback ---------------- */

async function listWithKey(listId, key) {
  const plr = await fetch(`${BASE}/playlists?part=snippet&id=${encodeURIComponent(listId)}&key=${key}`);
  const pld = await plr.json().catch(() => null);
  if (!plr.ok) {
    const reason = pld?.error?.errors?.[0]?.reason;
    const err = new Error(reason === "quotaExceeded" ? "quota_exceeded" : "data_api_error");
    err.status = reason === "quotaExceeded" ? 429 : plr.status;
    err.detail = pld && pld.error;
    throw err;
  }
  const title = pld?.items?.[0]?.snippet?.title || listId;
  if (!pld?.items?.length) { const e = new Error("playlist_not_found"); e.status = 404; throw e; }

  const videos = [];
  let pageToken = "", truncated = false;
  do {
    const purl = `${BASE}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${encodeURIComponent(listId)}${pageToken ? "&pageToken=" + pageToken : ""}&key=${key}`;
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

  if (!videos.length) { const e = new Error("no_videos"); e.status = 404; throw e; }
  return { playlist: { title, id: listId }, videos, truncated, via: "data-api" };
}

module.exports = async (req, res) => {
  // Same public, credential-free endpoint whether called from youchop.app or,
  // potentially, an extension surface, so answer any origin rather than assume one.
  res.setHeader("Access-Control-Allow-Origin", "*");
  const q = req.query || {};
  const listId = resolvePlaylistId(q);
  if (!listId) return res.status(400).json({ error: "Provide ?listId=PL…, or ?url=a playlist URL." });

  let firstError = null;
  try {
    return res.status(200).json(await listKeyless(listId));
  } catch (e) {
    firstError = String((e && e.message) || e);
  }

  const key = process.env.YT_DATA_API_KEY;
  if (key) {
    try {
      return res.status(200).json(await listWithKey(listId, key));
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
    message: "Could not list that playlist. Check the URL, or the playlist may be private.",
    keylessError: firstError,
  });
};
