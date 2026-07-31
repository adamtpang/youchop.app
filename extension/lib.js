/* lib.js — transcript extraction, shared by the content script and popup.
 *
 * The whole trick: this runs in the user's own browser on their own residential
 * IP, so YouTube serves captions normally. No API key, no proxy, no server, and
 * nothing leaves the machine. This is the path that datacenter-hosted scrapers
 * cannot take, and it is why the extension is the cheapest possible extractor.
 */

const YC = {
  videoIdFrom(url) {
    const s = String(url || "");
    const m =
      s.match(/[?&]v=([\w-]{11})/) ||
      s.match(/youtu\.be\/([\w-]{11})/) ||
      s.match(/\/shorts\/([\w-]{11})/) ||
      s.match(/\/embed\/([\w-]{11})/);
    return m ? m[1] : null;
  },

  clock(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
  },

  /* Pull the player response out of a watch page. Fetching the page fresh is more
     reliable than reading window vars, because YouTube is an SPA and the in-page
     object can be stale after client-side navigation. */
  async playerResponse(videoId) {
    const r = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { credentials: "include" });
    if (!r.ok) throw new Error(`watch page HTTP ${r.status}`);
    const html = await r.text();
    // the JSON is embedded in a script tag; walk braces so we stop at the right place
    const key = "ytInitialPlayerResponse";
    const at = html.indexOf(key);
    if (at === -1) throw new Error("no player response on page");
    const start = html.indexOf("{", at);
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < html.length; i++) {
      const c = html[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end === -1) throw new Error("could not parse player response");
    return JSON.parse(html.slice(start, end));
  },

  pickTrack(pr, prefer = "en") {
    const tracks =
      pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    if (!tracks.length) return null;
    const score = (t) => {
      const code = (t.languageCode || "").toLowerCase();
      let s = 0;
      if (code === prefer) s += 4;
      else if (code.startsWith(prefer)) s += 3;
      if (t.kind !== "asr") s += 1; // prefer human captions over auto-generated
      return s;
    };
    return tracks.slice().sort((a, b) => score(b) - score(a))[0];
  },

  async fetchTrack(track) {
    const url = track.baseUrl + "&fmt=json3";
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(`caption track HTTP ${r.status}`);
    const d = await r.json();
    const segs = [];
    for (const ev of d.events || []) {
      if (ev.aAppend) continue; // rolling-caption duplicate
      const text = (ev.segs || []).map((s) => s.utf8 || "").join("").replace(/\n/g, " ").trim();
      if (text) segs.push({ t: Math.floor((ev.tStartMs || 0) / 1000), text });
    }
    return segs;
  },

  meta(pr) {
    const vd = pr?.videoDetails || {};
    return {
      title: vd.title || "",
      author: vd.author || "",
      videoId: vd.videoId || "",
      duration: Number(vd.lengthSeconds || 0),
    };
  },

  /* format: "clean" | "timestamps" | "markdown" */
  render(segs, meta, format) {
    const url = `https://www.youtube.com/watch?v=${meta.videoId}`;
    if (format === "timestamps") {
      const body = segs.map((s) => `[${YC.clock(s.t)}] ${s.text}`).join("\n");
      return `# ${meta.title}\n${url}\n\n${body}\n`;
    }
    if (format === "markdown") {
      // paragraphs every ~60s, each headed by a deep link to that moment
      const paras = [];
      let cur = null;
      for (const s of segs) {
        if (!cur || s.t - cur.t >= 60) { if (cur) paras.push(cur); cur = { t: s.t, parts: [] }; }
        cur.parts.push(s.text);
      }
      if (cur) paras.push(cur);
      const body = paras
        .map((p) => `[${YC.clock(p.t)}](${url}&t=${p.t}s) ${p.parts.join(" ").replace(/\s+/g, " ").trim()}`)
        .join("\n\n");
      return `---\ntitle: "${meta.title.replace(/"/g, '\\"')}"\nauthor: "${meta.author.replace(/"/g, '\\"')}"\nsource_url: "${url}"\nvideo_id: "${meta.videoId}"\n---\n\n# ${meta.title}\n\nSource: [${meta.title}](${url})\n\n${body}\n`;
    }
    const text = segs.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
    return `# ${meta.title}\n${url}\n\n${text}\n`;
  },

  /* Read the transcript out of YouTube's own transcript panel, if the user has it
     open. This is the most robust local path because YouTube itself fetched the
     data with all the right tokens; we only read the rendered DOM. */
  fromPanel() {
    const rows = [...document.querySelectorAll("ytd-transcript-segment-renderer")]
      .map((s) => {
        const t = (s.querySelector(".segment-timestamp")?.textContent || "").trim();
        const text = (s.querySelector(".segment-text")?.textContent || "").trim();
        const parts = t.split(":").map(Number);
        const sec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                  : parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
        return { t: sec, text };
      })
      .filter((r) => r.text);
    return rows.length ? rows : null;
  },

  /* Ask youchop.app to fetch it. Used when the local paths are unavailable. */
  async fromApi(videoId, lang) {
    const r = await fetch("https://youchop.app/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [videoId], lang: lang || "en", timestamps: true }),
    });
    if (!r.ok) throw new Error(`youchop API HTTP ${r.status}`);
    const d = await r.json();
    const t = d?.transcripts?.[0];
    if (!t?.ok || !t.text) throw new Error("no transcript available for this video");
    // the API returns "[m:ss] line" rows when timestamps are requested
    const rows = t.text.split("\n").map((line) => {
      const m = line.match(/^\[(\d+):(\d{2})(?::(\d{2}))?\]\s*(.*)$/);
      if (!m) return { t: 0, text: line.trim() };
      const sec = m[3] ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
      return { t: sec, text: (m[4] || "").trim() };
    }).filter((r) => r.text);
    return { rows, title: t.title || "", author: t.author || "" };
  },

  /* Tries, in order: YouTube's open transcript panel (free, local, most reliable),
     the caption endpoint directly (free, but YouTube now bot-gates it and often
     returns an empty body), then youchop.app as the fallback that always works. */
  async extract(videoId, format = "clean", lang = "en") {
    let meta = { videoId, title: document.title.replace(/ - YouTube$/, ""), author: "", duration: 0 };
    let segs = null, source = null;

    const panel = YC.fromPanel();
    if (panel) { segs = panel; source = "panel"; }

    if (!segs) {
      try {
        const pr = await YC.playerResponse(videoId);
        meta = YC.meta(pr);
        const track = YC.pickTrack(pr, lang);
        if (track) {
          const s = await YC.fetchTrack(track);
          if (s.length) { segs = s; source = "captions"; }
        }
      } catch { /* fall through to the API */ }
    }

    if (!segs) {
      const api = await YC.fromApi(videoId, lang);
      segs = api.rows; source = "youchop.app";
      if (api.title) meta.title = api.title;
      if (api.author) meta.author = api.author;
    }

    if (!segs?.length) throw new Error("no transcript available for this video");
    return { text: YC.render(segs, meta, format), meta, segs, source };
  },
};

if (typeof module !== "undefined") module.exports = YC;
