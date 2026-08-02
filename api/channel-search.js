// GET /api/channel-search?q=veritasium   (or an @handle / channel URL / UC… id)
//
// Returns candidate channels for the picker. Needs NO key and no signup: it calls
// the same public innertube endpoint youtube.com's own search box uses. A handle,
// URL or UC… id skips search entirely and resolves straight off the channel page,
// which is both faster and exact.
//
// YT_DATA_API_KEY stays supported as an OPTIONAL fallback for when YouTube changes
// its response shape, but nothing here requires it.

const BASE = "https://www.googleapis.com/youtube/v3";

// Public constant embedded in youtube.com's own JavaScript. It identifies the web
// client; it is not a credential and grants no private access.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const CLIENT = { clientName: "WEB", clientVersion: "2.20250401.01.00" };
const CHANNELS_ONLY = "EgIQAg%3D%3D"; // search filter: type = channel
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

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

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function fixUrl(u) {
  return u ? (u.startsWith("//") ? "https:" + u : u) : "";
}

/* ---------------- keyless ---------------- */

// Resolve an exact handle or id straight off the channel page. No search needed,
// so an @handle can never come back as the wrong channel.
async function resolveExact(c) {
  const path = c.kind === "id" ? `channel/${c.value}` : `@${c.value}`;
  const r = await fetch(`https://www.youtube.com/${path}`, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
  });
  if (!r.ok) throw new Error(`channel page HTTP ${r.status}`);
  const html = await r.text();
  const id = (html.match(/"browseId":"(UC[\w-]{22})"/) ||
              html.match(/"externalId":"(UC[\w-]{22})"/) || [])[1];
  if (!id) throw new Error("no channel id on page");
  const pick = (re) => { const m = html.match(re); return m ? decodeEntities(m[1]) : ""; };
  return [{
    channelId: id,
    title: pick(/<meta property="og:title" content="([^"]*)"/) || c.value,
    description: pick(/<meta property="og:description" content="([^"]*)"/).slice(0, 160),
    thumb: fixUrl(pick(/<meta property="og:image" content="([^"]*)"/)),
  }];
}

async function searchKeyless(query) {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    body: JSON.stringify({ context: { client: CLIENT }, query, params: CHANNELS_ONLY }),
  });
  if (!r.ok) throw new Error(`innertube search HTTP ${r.status}`);
  const data = await r.json();

  const found = [];
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const ch = n.channelRenderer;
    if (ch && ch.channelId && !found.some((f) => f.channelId === ch.channelId)) {
      found.push({
        channelId: ch.channelId,
        title: ch.title?.simpleText || (ch.title?.runs || []).map((x) => x.text).join("") || "",
        description: (ch.descriptionSnippet?.runs || []).map((x) => x.text).join("").slice(0, 160),
        thumb: fixUrl(ch.thumbnail?.thumbnails?.[0]?.url || ""),
        handle: ch.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || "",
      });
    }
    for (const k of Object.keys(n)) walk(n[k]);
  })(data);

  if (!found.length) throw new Error("no channels parsed");
  return found.slice(0, 6);
}

/* ---------------- optional Data API fallback ---------------- */

async function withKey(c, key) {
  let url;
  if (c.kind === "id") url = `${BASE}/channels?part=snippet&id=${encodeURIComponent(c.value)}&key=${key}`;
  else if (c.kind === "handle") url = `${BASE}/channels?part=snippet&forHandle=${encodeURIComponent(c.value)}&key=${key}`;
  else url = `${BASE}/search?part=snippet&type=channel&maxResults=6&q=${encodeURIComponent(c.value)}&key=${key}`;

  let r = await fetch(url);
  let d = await r.json().catch(() => null);
  if (c.kind === "handle" && (!d || !d.items || !d.items.length)) {
    r = await fetch(`${BASE}/search?part=snippet&type=channel&maxResults=6&q=${encodeURIComponent(c.value)}&key=${key}`);
    d = await r.json().catch(() => null);
  }
  if (!r.ok) {
    const reason = d?.error?.errors?.[0]?.reason;
    const e = new Error(reason === "quotaExceeded" ? "quota_exceeded" : "data_api_error");
    e.status = reason === "quotaExceeded" ? 429 : r.status;
    e.detail = d && d.error;
    throw e;
  }
  return (d.items || []).map((it) => {
    const id = (it.id && it.id.channelId) || it.id;
    const sn = it.snippet || {};
    const t = sn.thumbnails || {};
    return {
      channelId: typeof id === "string" ? id : (id && id.channelId) || "",
      title: sn.channelTitle || sn.title || "",
      description: sn.description || "",
      thumb: (t.default && t.default.url) || (t.medium && t.medium.url) || "",
    };
  }).filter((x) => x.channelId);
}

module.exports = async (req, res) => {
  const q = (req.query && (req.query.q || req.query.handle || req.query.channel)) || "";
  const c = classify(q);
  if (!c) return res.status(400).json({ error: "Provide ?q= a channel name, @handle, or URL." });

  let firstError = null;
  try {
    const candidates = c.kind === "search" ? await searchKeyless(c.value) : await resolveExact(c);
    return res.status(200).json({ candidates, via: "keyless" });
  } catch (e) {
    firstError = String((e && e.message) || e);
  }

  const key = process.env.YT_DATA_API_KEY;
  if (key) {
    try {
      return res.status(200).json({ candidates: await withKey(c, key), via: "data-api" });
    } catch (e) {
      return res.status(e.status || 502).json({
        error: e.message || "lookup_failed",
        message: "Both the keyless search and the YouTube Data API failed.",
        keylessError: firstError,
        detail: e.detail,
      });
    }
  }

  return res.status(502).json({
    error: "lookup_failed",
    message: "Could not find that channel. Try the exact @handle or paste the channel URL.",
    keylessError: firstError,
  });
};
