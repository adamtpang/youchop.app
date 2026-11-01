/* lib.js, transcript extraction, shared by the content script and popup.
 *
 * The preferred paths run in the user's own browser on their own residential
 * IP, so YouTube serves captions normally. No API key or proxy is needed for
 * those paths. Explicit chapter generation sends the extracted transcript to
 * youchop.app; single-video extraction retains the hosted provider as a fallback.
 */

/* `var`, not `const`, on purpose: the service worker re-runs this file inside tabs
   that are already open when the extension updates. `const` would throw "already
   declared" and leave the stale build in place; `var` replaces the object, and the
   running content script picks the new one up because it looks YC up globally. */
var YC = {
  BUILD: "0.15.0",
  TRACE_CAP: 240,
  TRANSCRIPT_CACHE_KEY: "youchop.transcripts.v1",
  TRANSCRIPT_CACHE_TTL_MS: 90 * 24 * 60 * 60 * 1000,
  TRANSCRIPT_CACHE_CAP: 80,
  TRANSCRIPT_CACHE_MAX_CHARS: 7_000_000,
  traceLog: [],
  traceStartedAt: 0,

  resetTrace(detail = null) {
    YC.traceLog = [];
    YC.traceStartedAt = Date.now();
    YC.trace("extract.start", detail || {});
  },

  trace(stage, detail = "") {
    if (!YC.traceStartedAt) YC.traceStartedAt = Date.now();
    let text;
    if (typeof detail === "string") text = detail;
    else {
      try { text = JSON.stringify(detail); }
      catch { text = String(detail); }
    }
    const elapsed = String(Date.now() - YC.traceStartedAt).padStart(5, " ");
    YC.traceLog.push(`+${elapsed}ms ${stage}${text ? ` ${text}` : ""}`);
    if (YC.traceLog.length > YC.TRACE_CAP) YC.traceLog.splice(0, YC.traceLog.length - YC.TRACE_CAP);
  },

  formatTrace() {
    return YC.traceLog.length ? YC.traceLog.join("\n") : "(trace empty)";
  },

  runtimeVersion() {
    let manifest = "unavailable";
    try { manifest = chrome.runtime.getManifest().version || manifest; } catch {}
    return `lib=${YC.BUILD}, manifest=${manifest}`;
  },

  videoIdFrom(url) {
    const s = String(url || "");
    const m =
      s.match(/[?&]v=([\w-]{11})/) ||
      s.match(/youtu\.be\/([\w-]{11})/) ||
      s.match(/\/(?:shorts|live)\/([\w-]{11})/) ||
      s.match(/\/embed\/([\w-]{11})/);
    return m ? m[1] : null;
  },

  playlistIdFrom(url) {
    try {
      const u = new URL(String(url || ""), "https://www.youtube.com");
      const id = u.searchParams.get("list");
      return id && /^[\w-]{10,}$/.test(id) ? id : null;
    } catch { return null; }
  },

  playlistUrlFrom(url) {
    const id = YC.playlistIdFrom(url);
    return id ? `https://www.youtube.com/playlist?list=${id}` : null;
  },

  /* A channel page's identifying path segment, in whichever of YouTube's four
     shapes the URL uses: "@handle", "channel/UC...", "c/Name", "user/Name".
     Null on a watch page, search results, the homepage or anything else, so the
     caller can tell "this is a channel" from "this is not".
     The c/ and user/ prefixes are deliberately kept rather than reduced to the
     bare name: /api/channel-search resolves those two shapes exactly only when
     it can see the prefix, and degrades to a fuzzy name search without it. */
  channelRefFrom(url) {
    let path;
    // Fixed base rather than location.origin: this only ever sees youtube.com
    // URLs, and depending on ambient page state would make it untestable.
    try { path = new URL(String(url || ""), "https://www.youtube.com").pathname; }
    catch { return null; }
    const m =
      path.match(/^\/(@[\w.-]+)/) ||
      path.match(/^\/(channel\/UC[\w-]{22})/) ||
      path.match(/^\/(c\/[\w.-]+)/) ||
      path.match(/^\/(user\/[\w.-]+)/);
    return m ? m[1] : null;
  },

  // The canonical channel URL to hand to /extract, which parses all four shapes
  // exactly when given a full URL.
  channelUrlFrom(url) {
    const ref = YC.channelRefFrom(url);
    return ref ? "https://www.youtube.com/" + ref : null;
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
    YC.trace("captions.watch.request", { videoId });
    const r = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { credentials: "include" });
    YC.trace("captions.watch.response", { status: r.status, ok: r.ok });
    if (!r.ok) throw new Error(`watch page HTTP ${r.status}`);
    const html = await r.text();
    YC.trace("captions.watch.body", { bytes: html.length });
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
    const parsed = JSON.parse(html.slice(start, end));
    YC.trace("captions.player.parsed", {
      bytes: end - start,
      rootKeys: Object.keys(parsed || {}).slice(0, 16),
      tracks: parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || 0,
    });
    return parsed;
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
    let safeEndpoint = "caption endpoint";
    try { const u = new URL(url); safeEndpoint = u.host + u.pathname; } catch {}
    YC.trace("captions.track.request", {
      endpoint: safeEndpoint,
      language: track.languageCode || "unknown",
      kind: track.kind || "human",
    });
    const r = await fetch(url, { credentials: "include" });
    YC.trace("captions.track.response", { status: r.status, ok: r.ok });
    if (!r.ok) throw new Error(`caption track HTTP ${r.status}`);
    const raw = await r.text();
    YC.trace("captions.track.body", { bytes: raw.length, nonWhitespace: raw.trim().length });
    if (!raw.trim()) throw new Error("caption endpoint returned an empty response");
    let d;
    try { d = JSON.parse(raw); }
    catch { throw new Error("caption endpoint returned invalid JSON"); }
    const segs = [];
    for (const ev of d.events || []) {
      if (ev.aAppend) continue; // rolling-caption duplicate
      const text = (ev.segs || []).map((s) => s.utf8 || "").join("").replace(/\n/g, " ").trim();
      if (text) segs.push({ t: Math.floor((ev.tStartMs || 0) / 1000), text });
    }
    YC.trace("captions.track.parsed", { events: d.events?.length || 0, rows: segs.length });
    return segs;
  },

  /* YouTube's transcript panel is itself backed by a same-origin
     /youtubei/v1/get_transcript request. Sometimes the panel expands but leaves a
     continuation spinner in place forever, so no transcript DOM is ever rendered.
     The service worker asks the page's MAIN world to make that authenticated
     request, which guarantees normal same-origin cookie and CORS behavior.
     This stays local and free, and avoids spending the hosted provider quota. */
  async transcriptEndpointResponse() {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      throw new Error("extension runtime unavailable");
    }
    YC.trace("youtube.main_world.request", { message: "youchop-transcript-context" });
    const d = await chrome.runtime.sendMessage({ type: "youchop-transcript-context" });
    YC.trace("youtube.main_world.response", {
      ok: !!d?.ok,
      error: d?.error || "",
      debug: d?.debug || null,
    });
    if (!d?.ok) throw new Error(d?.error || "transcript continuation unavailable");
    return d;
  },

  textValue(value) {
    if (typeof value === "string") return value.trim();
    if (!value || typeof value !== "object") return "";
    if (typeof value.simpleText === "string") return value.simpleText.trim();
    if (typeof value.content === "string") return value.content.trim();
    if (Array.isArray(value.runs)) {
      return value.runs.map((r) => r?.text || "").join("").trim();
    }
    return "";
  },

  /* The endpoint has shipped two segment shapes: transcriptSegmentRenderer and
     transcriptSegmentViewModel. Find either recursively so harmless response
     wrappers can change without breaking extraction again. */
  parseTranscriptResponse(data) {
    const candidates = [];
    const walk = (value) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) { for (const item of value) walk(item); return; }
      for (const [key, child] of Object.entries(value)) {
        if (/^transcriptSegment(?:Renderer|ViewModel)$/i.test(key) && child && typeof child === "object") {
          candidates.push(child);
        } else {
          walk(child);
        }
      }
    };
    walk(data);

    const rows = [];
    for (const seg of candidates) {
      const stamp = YC.textValue(seg.startTimeText || seg.startTime || seg.timestampText);
      let t = Number(seg.startMs ?? seg.startTimeMs ?? seg.startTimeMilliseconds);
      if (!Number.isFinite(t)) t = YC.toSec(stamp);
      else t = Math.floor(t / 1000);
      const text = YC.textValue(seg.snippet || seg.text || seg.transcriptSnippet || seg.body);
      if (t === null || !Number.isFinite(t) || !text || text === stamp) continue;
      rows.push({ t, text });
    }

    const seen = new Set();
    const result = rows
      .sort((a, b) => a.t - b.t)
      .filter((row) => {
        const key = `${row.t}|${row.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    YC.trace("youtube.transcript.parsed", {
      candidates: candidates.length,
      rowsBeforeDedupe: rows.length,
      rows: result.length,
      rootKeys: Object.keys(data || {}).slice(0, 16),
      firstCandidateKeys: Object.keys(candidates[0] || {}).slice(0, 20),
    });
    return result;
  },

  async fetchTranscriptContinuation() {
    if (YC.lastEndpointError) throw YC.lastEndpointError;
    const response = YC.lastEndpointResult || await YC.transcriptEndpointResponse();
    YC.lastEndpointResult = null;
    const rows = response.nativeRendered ? (YC.fromPanel() || []) : YC.parseTranscriptResponse(response.data);
    if (!rows.length) throw new Error("YouTube transcript response had no segments");
    YC.trace("youtube.transcript.success", { rows: rows.length, nativeRendered: !!response.nativeRendered });
    return rows;
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

  safeFilename(value, fallback = "transcript") {
    const cleaned = String(value || "")
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 96);
    return cleaned || fallback;
  },

  /* A playlist is a collection of documents, not one giant document. Keep every
     successful video's transcript standalone so it has its own filename,
     frontmatter, source URL, and copy/download target in the result panel. */
  playlistDocuments(items, playlist, format = "markdown") {
    const rows = items || [];
    const width = Math.max(2, String(rows.length || 1).length);
    const listId = playlist?.id || "";
    const playlistTitle = playlist?.title || "YouTube playlist";
    const playlistUrl = listId ? `https://www.youtube.com/playlist?list=${listId}` : "";
    const yaml = (value) => String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/[\r\n]+/g, " ");

    return rows.map((item, index) => {
      const sourceMeta = item.meta || {};
      const videoId = sourceMeta.videoId || item.videoId || "";
      const title = sourceMeta.title || item.title || `Video ${index + 1}`;
      const meta = { ...sourceMeta, videoId, title };
      const position = index + 1;
      let text = YC.render(item.segs || [], meta, format);

      if (format === "markdown") {
        const closingFrontmatter = text.indexOf("\n---\n", 4);
        if (closingFrontmatter >= 0) {
          const playlistFields =
            `\nplaylist_title: "${yaml(playlistTitle)}"` +
            (playlistUrl ? `\nplaylist_url: "${yaml(playlistUrl)}"` : "") +
            `\nplaylist_position: ${position}`;
          text = text.slice(0, closingFrontmatter) + playlistFields + text.slice(closingFrontmatter);
        }
      }

      const prefix = String(position).padStart(width, "0");
      const fallback = `${prefix} video-${videoId || position}`;
      const base = YC.safeFilename(`${prefix} ${title}`, fallback);
      return {
        position,
        videoId,
        title,
        filename: `${base}.${format === "markdown" ? "md" : "txt"}`,
        text,
      };
    });
  },

  /* One durable document for an entire playlist. Each video keeps its source URL
     and timestamp deep links, so the downloaded Markdown remains useful outside
     YouTube and can be dropped directly into an LLM or knowledge base. */
  renderPlaylist(items, playlist, format = "markdown", failures = []) {
    const title = playlist?.title || "YouTube playlist";
    const listId = playlist?.id || "";
    const playlistUrl = listId ? `https://www.youtube.com/playlist?list=${listId}` : "";
    const head = `# ${title}\n${playlistUrl ? `\nSource: ${playlistUrl}\n` : ""}\n`;
    const blocks = (items || []).map((item, index) => {
      const meta = item.meta || {};
      const segs = item.segs || [];
      const videoId = meta.videoId || item.videoId || "";
      const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
      const videoTitle = meta.title || item.title || `Video ${index + 1}`;
      let body;
      if (format === "clean") {
        body = segs.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
      } else if (format === "timestamps") {
        body = segs.map((s) => `[${YC.clock(s.t)}] ${s.text}`).join("\n");
      } else {
        const paras = [];
        let cur = null;
        for (const s of segs) {
          if (!cur || s.t - cur.t >= 60) {
            if (cur) paras.push(cur);
            cur = { t: s.t, parts: [] };
          }
          cur.parts.push(s.text);
        }
        if (cur) paras.push(cur);
        body = paras.map((p) =>
          `[${YC.clock(p.t)}](${url}&t=${p.t}s) ${p.parts.join(" ").replace(/\s+/g, " ").trim()}`
        ).join("\n\n");
      }
      return `## ${index + 1}. ${videoTitle}\n${url}\n\n${body}`;
    });
    if (failures?.length) {
      blocks.push(
        "## Videos that could not be chopped\n\n" +
        failures.map((f) => `- ${f.title || f.videoId}: ${f.error || "unknown error"}`).join("\n")
      );
    }
    return head + blocks.join("\n\n---\n\n") + "\n";
  },

  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),

  videoDuration() {
    const v = document.querySelector("video");
    return v && isFinite(v.duration) && v.duration > 0 ? Math.floor(v.duration) : 0;
  },

  toSec(stamp) {
    const p = String(stamp).trim().split(":").map(Number);
    if (p.some(isNaN)) return null;
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2]
         : p.length === 2 ? p[0] * 60 + p[1] : null;
  },

  /* Read whatever transcript rows are rendered in YouTube's panel.
     YouTube's markup for this panel has changed before, so rather than trust one
     selector we try three strategies, ending with a structural one that only
     assumes "a row begins with a timestamp". YC.lastPanelStrategy records which
     worked, so a failure can report why instead of guessing. */
  lastPanelStrategy: null,
  lastEndpointResult: null,
  lastEndpointError: null,

  fromPanel() {
    const mk = (stamp, text) => {
      const sec = YC.toSec(stamp);
      return sec === null || !text ? null : { t: sec, text: text.trim() };
    };

    // 1. the row element itself. `transcript-segment-view-model` is what YouTube
    //    actually renders (confirmed by inspecting a live watch page, 2026-08);
    //    `ytd-transcript-segment-renderer` is the older name and no longer exists.
    //    Cheap and exact, so it runs first; the structural scan below is the net
    //    for whenever these get renamed again.
    let rows = [];
    for (const seg of document.querySelectorAll("transcript-segment-view-model, ytd-transcript-segment-renderer")) {
      const stampEl = [...seg.querySelectorAll("*")]
        .find((e) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test((e.textContent || "").trim()));
      if (!stampEl) continue;
      const r = mk(stampEl.textContent.trim(), YC.rowText(seg, stampEl));
      if (r) rows.push(r);
    }
    if (rows.length) { YC.lastPanelStrategy = "transcript-segment-view-model"; return rows; }

    // 2. class-name variants, in case the element was renamed
    rows = [...document.querySelectorAll('[class*="transcript-segment"], [class*="segment-renderer"]')]
      .map((s) => mk(s.querySelector('[class*="timestamp"]')?.textContent || "",
                     s.querySelector('[class*="segment-text"], [class*="text"]')?.textContent || ""))
      .filter(Boolean);
    if (rows.length) { YC.lastPanelStrategy = "class-variant"; return rows; }

    // 3. structural, DOCUMENT-WIDE. Deliberately not scoped to a container:
    //    guessing which element wraps the transcript is what broke strategies 1
    //    and 2. A transcript is simply the largest cluster of sibling rows whose
    //    text begins with a timestamp, so find that instead of naming anything.
    //
    //    NOT a substitute for strategies 1/2, only a net for when they are renamed
    //    again: a live watch page (2026-08) had zero transcript-segment-view-model
    //    rows because the panel's own list hadn't finished rendering yet, and this
    //    scan's biggest cluster turned out to be the CHAPTERS panel instead
    //    (ytd-macro-markers-list-item-renderer, in a separate hidden panel), whose
    //    rows each also repeat their own title twice internally. The result was a
    //    "successful" extraction that was actually the chapter list, doubled. So
    //    known non-transcript containers are excluded before ranking groups, and
    //    a match is required to look genuinely per-line: the video's total runtime
    //    divided by the number of rows must be under 40s/row. Chapter markers are
    //    typically 2-6 minutes apart; real caption lines are a few seconds apart.
    const hits = YC.timestampRows();
    const duration = YC.videoDuration();
    const perRow = duration && hits.rows.length ? duration / hits.rows.length : 0;
    if (hits.rows.length >= 5 && (!perRow || perRow <= 40)) {
      YC.lastPanelStrategy = `structural (${hits.rows.length} rows under ${hits.where})`;
      return hits.rows;
    }
    if (hits.rows.length >= 5) {
      YC.lastPanelStrategy = `rejected structural match: ${hits.rows.length} rows under ${hits.where}, ` +
        `~${Math.round(perRow)}s apart (looks like chapters, not per-line captions)`;
    }

    YC.lastPanelStrategy = YC.lastPanelStrategy && /^rejected/.test(YC.lastPanelStrategy) ? YC.lastPanelStrategy : null;
    return null;
  },

  // Containers that are known to render "MM:SS  words" text but are never the
  // transcript: chapters, the end-screen video wall, related-video cards, the
  // player's own scrubber, and the description (which often lists chapters as
  // plain text, rendered once collapsed and again expanded).
  NOT_TRANSCRIPT: /macro-markers|ytp-chrome-bottom|ytp-modern-videowall|ytLockupViewModel|description|ytAttributedString/i,
  NOT_TRANSCRIPT_SELECTOR: "#movie_player, ytd-macro-markers-list-item-renderer, [class*='macro-markers'], [id*='description'], [class*='ytLockupViewModel']",

  /* Every element in the document whose entire text is a timestamp, grouped by the
     tag+class signature of the row around it; the biggest group is the transcript.
     Chapter lists, the video wall and timestamped comments form much smaller
     groups, so size disambiguates them without depending on any YouTube name. */
  timestampRows() {
    const ONLY = /^(\d{1,2}:\d{2}(?::\d{2})?)$/;
    const bySig = new Map();

    for (const el of document.querySelectorAll("div, span, button, a, yt-formatted-string")) {
      const txt = (el.textContent || "").trim();
      const m = txt.match(ONLY);
      if (!m) continue;
      if (el.closest(YC.NOT_TRANSCRIPT_SELECTOR)) continue;
      // Climb past wrappers that add nothing, so `row` is the first ancestor that
      // holds words as well as the stamp.
      let stampEl = el, row = el.parentElement;
      while (row && (row.textContent || "").trim() === txt) { stampEl = row; row = row.parentElement; }
      if (!row) continue;
      if (YC.NOT_TRANSCRIPT.test(row.className || "") || row.closest('[class*="macro-markers"], [id*="description"]')) continue;
      const text = YC.rowText(row, stampEl);
      if (text.length < 2) continue;
      // Group by the row's tag+class SIGNATURE, not by parent identity. Every row
      // sits in its own wrapper, so grouping by parentElement produced one row per
      // group and the transcript never out-sized the chapter list.
      const sig = row.tagName + "|" + (row.className || "").toString();
      if (!bySig.has(sig)) bySig.set(sig, []);
      bySig.get(sig).push({ stamp: m[1], text });
    }

    let best = [], bestSig = null;
    for (const [k, v] of bySig) if (v.length > best.length) { best = v; bestSig = k; }
    const seen = new Set(), rows = [];
    for (const r of best) {
      const sec = YC.toSec(r.stamp);
      if (sec === null || seen.has(sec)) continue;
      seen.add(sec);
      rows.push({ t: sec, text: YC.dedupeInternalRepeat(r.text) });
    }
    rows.sort((a, b) => a.t - b.t);
    return { rows, where: bestSig ? bestSig.split("|")[0].toLowerCase() : "none", groups: bySig.size };
  },

  // A row whose assembled text is the same phrase twice back-to-back (seen on
  // chapter rows, which render their title in two children for hover/base states)
  // collapses to one copy. Harmless on genuine transcript text, which never
  // legitimately repeats its exact sentence immediately against itself.
  dedupeInternalRepeat(text) {
    const n = text.length;
    if (n < 4 || n % 2 !== 0) return text;
    const half = n / 2;
    return text.slice(0, half) === text.slice(half) ? text.slice(0, half) : text;
  },

  /* Read one row's words. YouTube puts a screen-reader duration label between the
     stamp and the text, so a row's raw textContent is "0:07" + "7 seconds" +
     "This program is...". Reading textContent directly bakes "7 seconds" into
     every single line, so drop that label and the stamp and keep the rest. */
  A11Y_LABEL: /^\d+\s+(hour|minute|second)s?([\s,]+\d+\s+(minute|second)s?)*$/i,

  rowText(row, stampEl) {
    const parts = [];
    for (const kid of row.children) {
      if (kid === stampEl || kid.contains(stampEl)) continue;
      const t = (kid.textContent || "").trim();
      if (!t || YC.A11Y_LABEL.test(t)) continue;
      if (/a11y|visually-hidden|sr-only/i.test((kid.className || "").toString())) continue;
      parts.push(t);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  },

  /* How many elements contain nothing but a timestamp. This distinguishes
     "the transcript is not rendered" from "it is rendered in a layout we did not
     parse", which the previous diagnostic could not tell apart. */
  stampOnlyCount(includeKnownNoise = false) {
    let n = 0;
    for (const el of document.querySelectorAll("span, div, button, yt-formatted-string, a")) {
      if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test((el.textContent || "").trim()) &&
          (includeKnownNoise || !el.closest(YC.NOT_TRANSCRIPT_SELECTOR))) n++;
    }
    return n;
  },

  /* What the page looks like right now, for honest error reporting. */
  panelDiagnostics() {
    const q = (s) => document.querySelectorAll(s).length;
    const panels = [...document.querySelectorAll("ytd-engagement-panel-section-list-renderer")]
      .map((p) => `${p.getAttribute("target-id") || "?"}=${(p.getAttribute("visibility") || "?").replace("ENGAGEMENT_PANEL_VISIBILITY_", "")}`)
      .filter((s) => /transcript/i.test(s));
    let ts = { rows: [], where: "n/a", groups: 0 };
    try { ts = YC.timestampRows(); } catch {}
    const vis = YC.visibleTranscriptPanel();
    const chips = vis
      ? [...vis.querySelectorAll("chip-view-model, [role='tab']")]
          .map((c) => (c.textContent || "").trim()).filter(Boolean).join("/")
      : "";
    const panelDetails = YC.transcriptPanels().map((p) => {
      const content = p.querySelector("#content") || p;
      const continuation = p.querySelector("ytd-continuation-item-renderer");
      const spinner = continuation?.querySelector("tp-yt-paper-spinner, [active], .spinner");
      return {
        target: p.getAttribute("target-id") || "?",
        visibility: (p.getAttribute("visibility") || "?").replace("ENGAGEMENT_PANEL_VISIBILITY_", ""),
        contentChildren: content?.children?.length || 0,
        continuation: !!continuation,
        spinner: !!spinner,
        textChars: (content?.textContent || "").trim().length,
      };
    });
    return {
      visiblePanel: vis ? (vis.getAttribute("target-id") || "?") + "=" +
        (vis.getAttribute("visibility") || "?").replace("ENGAGEMENT_PANEL_VISIBILITY_", "") : "none",
      chips: chips || "none",
      segmentEls: q("ytd-transcript-segment-renderer"),
      classVariants: q('[class*="transcript-segment"], [class*="segment-renderer"]'),
      transcriptPanels: panels.length ? panels.join(", ") : "none",
      timestampRowsFound: ts.rows.length,
      timestampRowsUnder: ts.where,
      timestampGroups: ts.groups,
      stampOnly: (() => { try { return YC.stampOnlyCount(); } catch { return -1; } })(),
      rawStampOnly: (() => { try { return YC.stampOnlyCount(true); } catch { return -1; } })(),
      panelDetails,
      strategy: YC.lastPanelStrategy || "none matched",
      duration: YC.videoDuration(),
    };
  },

  /* ---------- failure log ----------
     The in-panel diagnostic above is thorough but ephemeral: it is gone the moment
     the panel closes or YouTube client-navigates, so a failure noticed in passing
     cannot be reported afterwards. Keep the last FAILURE_LOG_CAP of them.

     Each entry records the build version deliberately. This extension runs
     unpacked and is reloaded often, and background.js exists precisely because
     stale content scripts kept answering after a fix had landed. A log without the
     version invites re-debugging something already fixed. */
  FAILURE_LOG_KEY: "youchop.failures",
  FAILURE_LOG_CAP: 50,

  storage() {
    // lib.js is also require()d by the node tests, and a content script can run
    // where storage is unavailable. Neither should turn a transcript failure into
    // a second, louder failure, so absence is a normal answer here, not an error.
    try { return (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) || null; }
    catch { return null; }
  },

  // Coverage is a warning heuristic, never proof of transcription accuracy.
  transcriptReadiness(segs, meta = {}) {
    if (!segs?.length) return { ready: false, reason: "No transcript is available." };
    const valid = segs.every(s => Number.isFinite(s.t) && s.t >= 0);
    const last = Math.max(...segs.map(s => Number(s.t) || 0));
    if (!valid || last === 0)
      return { ready: false, reason: "This transcript has no usable timestamps." };
    const duration = Number(meta.duration);
    if (!(duration > 0)) return { ready: false, reason: "Transcript coverage could not be checked." };
    if (segs.some((s, i) => i && s.t < segs[i - 1].t) || last > duration + 10)
      return { ready: false, reason: "Transcript timing looks inconsistent." };
    if (segs[0].t > 30 || segs.some((s, i) => i && s.t - segs[i - 1].t > 90))
      return { ready: false, reason: "This transcript has long gaps. They may be missing speech or silence." };
    if (duration - last > 30)
      return { ready: false, reason: "This transcript may end early. Silence or an outro can also cause this." };
    return { ready: true, reason: "" };
  },

  transcriptCacheId(videoId, lang = "en") {
    return `${String(videoId || "")}:${String(lang || "en").toLowerCase()}`;
  },

  async readTranscriptCache(videoId, lang = "en") {
    const store = YC.storage();
    if (!store) return null;
    try {
      const payload = await store.get(YC.TRANSCRIPT_CACHE_KEY);
      const records = payload?.[YC.TRANSCRIPT_CACHE_KEY];
      const key = YC.transcriptCacheId(videoId, lang);
      const record = records && typeof records === "object" ? records[key] : null;
      if (!record || Date.now() - Number(record.savedAt || 0) > YC.TRANSCRIPT_CACHE_TTL_MS) return null;
      if (!Array.isArray(record.segs) || !record.segs.length || record.videoId !== videoId) return null;
      const segs = record.segs.map((segment) => ({
        t: Math.max(0, Math.floor(Number(segment.t) || 0)),
        text: String(segment.text || "").replace(/\s+/g, " ").trim(),
      })).filter((segment) => segment.text);
      if (!segs.length) return null;
      return {
        segs,
        meta: {
          videoId,
          title: String(record.meta?.title || ""),
          author: String(record.meta?.author || ""),
          duration: Math.max(0, Math.floor(Number(record.meta?.duration) || 0)),
        },
        savedAt: Number(record.savedAt),
        originalSource: String(record.source || ""),
      };
    } catch {
      return null;
    }
  },

  async saveTranscriptCache(videoId, lang, segs, meta, source) {
    const store = YC.storage();
    if (!store || !Array.isArray(segs) || !segs.length) return false;
    try {
      const cleaned = segs.slice(0, 20_000).map((segment) => ({
        t: Math.max(0, Math.floor(Number(segment.t) || 0)),
        text: String(segment.text || "").replace(/\s+/g, " ").trim(),
      })).filter((segment) => segment.text);
      if (!cleaned.length) return false;

      const payload = await store.get(YC.TRANSCRIPT_CACHE_KEY);
      const existing = payload?.[YC.TRANSCRIPT_CACHE_KEY];
      const records = existing && typeof existing === "object" ? { ...existing } : {};
      const now = Date.now();
      records[YC.transcriptCacheId(videoId, lang)] = {
        version: 1,
        videoId,
        lang: String(lang || "en").toLowerCase(),
        meta: {
          title: String(meta?.title || "").slice(0, 500),
          author: String(meta?.author || "").slice(0, 500),
          duration: Math.max(0, Math.floor(Number(meta?.duration) || 0)),
        },
        segs: cleaned,
        source: String(source || ""),
        savedAt: now,
      };

      // Remove expired entries first, then oldest entries until both the count
      // and Chrome storage budget are bounded. Successful extraction must still
      // return if storage is full or unavailable.
      let entries = Object.entries(records)
        .filter(([, record]) => now - Number(record?.savedAt || 0) <= YC.TRANSCRIPT_CACHE_TTL_MS)
        .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0));
      entries = entries.slice(0, YC.TRANSCRIPT_CACHE_CAP);
      let bounded = Object.fromEntries(entries);
      while (entries.length > 1 && JSON.stringify(bounded).length > YC.TRANSCRIPT_CACHE_MAX_CHARS) {
        entries.pop();
        bounded = Object.fromEntries(entries);
      }
      await store.set({ [YC.TRANSCRIPT_CACHE_KEY]: bounded });
      return !!bounded[YC.transcriptCacheId(videoId, lang)];
    } catch {
      return false;
    }
  },

  async logFailure(entry) {
    const store = YC.storage();
    if (!store) return null;
    try {
      let version = "";
      try { version = chrome.runtime.getManifest().version; } catch {}
      const rec = {
        at: new Date().toISOString(),
        version,
        videoId: entry.videoId || "",
        title: entry.title || "",
        url: entry.url || "",
        // The diagnostic block is bounded, but an unexpected error could carry a
        // huge message and storage.local is a shared budget.
        message: String(entry.message || "").slice(0, 16000),
        diagnostics: entry.diagnostics || null,
      };
      const cur = await store.get(YC.FAILURE_LOG_KEY);
      const log = Array.isArray(cur && cur[YC.FAILURE_LOG_KEY]) ? cur[YC.FAILURE_LOG_KEY] : [];
      log.push(rec);
      // keep the newest, drop the oldest
      await store.set({ [YC.FAILURE_LOG_KEY]: log.slice(-YC.FAILURE_LOG_CAP) });
      return rec;
    } catch { return null; }
  },

  async readFailures() {
    const store = YC.storage();
    if (!store) return [];
    try {
      const cur = await store.get(YC.FAILURE_LOG_KEY);
      return Array.isArray(cur && cur[YC.FAILURE_LOG_KEY]) ? cur[YC.FAILURE_LOG_KEY] : [];
    } catch { return []; }
  },

  async clearFailures() {
    const store = YC.storage();
    if (!store) return;
    try { await store.remove(YC.FAILURE_LOG_KEY); } catch {}
  },

  /* One block of plain text covering every logged failure, for pasting into a
     bug report. */
  formatFailures(log) {
    if (!log || !log.length) return "No failed chops logged.";
    return log.map(function (r, i) {
      return [
        "---- " + (i + 1) + "/" + log.length + "  " + r.at + "  extension v" + (r.version || "?"),
        r.title || "(no title)",
        r.url || r.videoId || "(no url)",
        r.message || "(no message)",
      ].join("\n");
    }).join("\n\n");
  },

  /* Open YouTube's transcript panel if it is not already showing, so the user
     only has to click once. Needs the description expanded first, because that is
     where the button lives. */
  /* There is more than one transcript panel in the DOM. Browser inspection of a
     live watch page (2026-08) found both `PAmodern_transcript_view` and
     `engagement-panel-searchable-transcript`, and the first one in document order
     was HIDDEN. Taking querySelector's first match therefore inspected the wrong
     panel and reported "present (HIDDEN)" while the real one was expanded. */
  transcriptPanels() {
    return [...document.querySelectorAll("ytd-engagement-panel-section-list-renderer")]
      .filter((p) => /transcript/i.test(p.getAttribute("target-id") || ""));
  },

  /* Lenient: falls back to the first transcript panel even when every one of them
     is HIDDEN. Only safe for DIAGNOSTICS, where the goal is "name a panel to
     report on". Never use it to decide whether the panel is open: see
     expandedTranscriptPanel() for that. */
  visibleTranscriptPanel() {
    const panels = YC.transcriptPanels();
    return panels.find((p) => !/HIDDEN/i.test(p.getAttribute("visibility") || "")) || panels[0] || null;
  },

  /* Strict: a transcript panel that is actually EXPANDED, or null. This is the
     open/closed test.
     Why it exists: openPanel() used to branch on visibleTranscriptPanel(), whose
     `|| panels[0]` fallback returns a HIDDEN panel rather than null. On a normal
     watch page both panels (`PAmodern_transcript_view` and
     `engagement-panel-searchable-transcript`) are HIDDEN until the user asks for
     one, so that check was ALWAYS truthy. openPanel therefore took the
     "already open, just wait for rows" branch every time, burned its ~10s budget
     waiting for rows that a hidden panel will never render, and returned false
     without ever reaching the code that finds and clicks "Show transcript".
     Verified live 2026-08-22: both panels HIDDEN, yet the old check returned
     `PAmodern_transcript_view` as if the panel were open. */
  expandedTranscriptPanel() {
    return YC.transcriptPanels()
      .find((p) => !/HIDDEN/i.test(p.getAttribute("visibility") || "")) || null;
  },

  /* The panel is tabbed: a chip bar offers "Timeline" and "Transcript", and it can
     open on Timeline, in which case no transcript rows exist yet. Select the
     Transcript chip if one is present. */
  async selectTranscriptChip() {
    const panel = YC.visibleTranscriptPanel();
    if (!panel) {
      YC.trace("panel.chip", { result: "no transcript panel" });
      return false;
    }
    const candidates = [...panel.querySelectorAll("chip-view-model, button, div[role='tab'], [role='tab']")];
    const matches = candidates.filter((c) => /^transcript$/i.test((c.textContent || "").trim()));
    // A chip wrapper and its button have identical text. The button owns the
    // selected state and click handler; clicking the wrapper can do nothing.
    const chip = matches.find((c) => c.tagName.toLowerCase() === "button") || matches[0];
    YC.trace("panel.chip.scan", {
      panel: panel.getAttribute("target-id") || "?",
      visibility: panel.getAttribute("visibility") || "?",
      candidates: candidates.slice(0, 16).map((c) => ({
        text: (c.textContent || "").trim().slice(0, 40),
        selected: c.getAttribute("aria-selected") || "",
        tag: c.tagName.toLowerCase(),
      })),
    });
    if (!chip) {
      YC.trace("panel.chip", { result: "Transcript chip not found" });
      return false;
    }
    const already = /true/i.test(chip.getAttribute("aria-selected") || "");
    YC.trace("panel.chip", { result: already ? "already selected" : "clicking", tag: chip.tagName.toLowerCase() });
    if (!already) { chip.click(); await YC.sleep(900); }
    return true;
  },

  /* A transcript continuation can be present but never fire because YouTube has
     rendered its panel at 0x0 pixels. Ask the service worker to invoke the
     component's own MAIN-world continuation method. Cache any endpoint response
     so extract() can consume it without issuing the request twice. */
  async primeTranscriptContinuation() {
    const panel = YC.expandedTranscriptPanel();
    const continuation = panel?.querySelector("ytd-continuation-item-renderer");
    if (!continuation) {
      YC.trace("youtube.native_trigger.skip", { reason: "no continuation element" });
      return false;
    }
    YC.trace("youtube.native_trigger.start", {
      panel: panel.getAttribute("target-id") || "?",
      panelWidth: Math.round(panel.getBoundingClientRect?.().width || 0),
      panelHeight: Math.round(panel.getBoundingClientRect?.().height || 0),
    });
    try {
      const response = await YC.transcriptEndpointResponse();
      YC.lastEndpointResult = response;
      const rows = response.nativeRendered ? (YC.fromPanel() || []) : [];
      YC.trace("youtube.native_trigger.done", {
        nativeRendered: !!response.nativeRendered,
        domRows: rows.length,
        hasFallbackData: !!response.data,
      });
      return rows.length > 0;
    } catch (error) {
      YC.lastEndpointError = error;
      YC.trace("youtube.native_trigger.failed", { error: String(error?.message || error).slice(0, 240) });
      return false;
    }
  },

  /* `report(frac, message)` is optional, frac 0..1 across the opening phase only.
     Opening the panel is the slowest, most failure-prone part of a chop and used
     to be a silent ~10-20s dead zone: the caller announced "opening transcript"
     at 0% once, then the polling loops below ran with nothing to show, so the bar
     looked frozen exactly when the user most wants to know something is happening.
     Every wait loop here now ticks, and every step says what it is doing. */
  async openPanel(report = null) {
    const say = (f, m) => {
      const fraction = Math.max(0, Math.min(1, f));
      YC.trace("panel.open", { fraction: Math.round(fraction * 100) / 100, message: m });
      if (report) report(fraction, m);
    };

    say(0.02, "checking for an open transcript");
    if (YC.fromPanel()) { say(1, "transcript already open"); return true; }

    // Panel may already be open — either showing the Timeline tab, or still loading
    // its rows (the legacy `ytd-transcript-search-panel-renderer` variant can spend
    // several seconds on a spinner before `ytd-transcript-segment-renderer` rows
    // exist at all; confirmed live 2026-08 on a video with the panel already
    // EXPANDED but zero segment elements). Give it the SAME wait budget as the
    // click-and-wait path below, then stop: there is no "Show transcript" button to
    // find while the panel is already showing, so falling through to hunt for one
    // (the old behavior) always failed and threw away everything already waited.
    if (YC.expandedTranscriptPanel()) {
      say(0.06, "transcript panel is open, selecting the Transcript tab");
      await YC.selectTranscriptChip();
      say(0.09, "asking YouTube to trigger its transcript loader");
      if (await YC.primeTranscriptContinuation()) {
        say(1, "YouTube loaded the lines");
        return true;
      }
      const deadline = Date.now() + 10000;
      for (let i = 0; i < 30 && Date.now() < deadline; i++) {
        await YC.sleep(320);
        if (YC.fromPanel()) { say(1, "lines are in"); return true; }
        if (i === 8 || i === 18) {
          say(0.1 + (i / 30) * 0.85, "still empty, re-selecting the Transcript tab");
          await YC.selectTranscriptChip();
        } else {
          say(0.1 + (i / 30) * 0.85, `waiting for YouTube to load the lines (${i + 1}/30)`);
        }
        // Nudge the lazy-load: some panel variants only fetch their rows once the
        // loading placeholder actually intersects the viewport.
        const cont = document.querySelector(
          "ytd-engagement-panel-section-list-renderer:not([visibility*='HIDDEN']) ytd-continuation-item-renderer"
        );
        if (cont) cont.scrollIntoView({ block: "nearest" });
      }
      const found = !!YC.fromPanel();
      YC.trace("panel.open.done", { branch: "already-expanded", found });
      return found;
    }

    // The button lives inside the (collapsed) description, so expand that first.
    say(0.08, "expanding the description");
    for (const sel of ["#description-inline-expander #expand", "tp-yt-paper-button#expand",
                       "#expand", "#description #expand"]) {
      const e = document.querySelector(sel);
      if (e) { e.click(); await YC.sleep(600); break; }
    }

    // Look in the transcript section first, then fall back to a targeted scan.
    // The match must be tight: a loose /transcript/i hits unrelated links and
    // clicking the wrong element silently does nothing.
    const exact = (el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      const a = (el.getAttribute("aria-label") || "").trim().toLowerCase();
      return t === "show transcript" || a === "show transcript" ||
             t.startsWith("show transcript") || a.startsWith("show transcript");
    };
    const findBtn = () => {
      const section = document.querySelector("ytd-video-description-transcript-section-renderer");
      const scope = section ? [section] : [document];
      for (const root of scope) {
        const btns = [...root.querySelectorAll("button, tp-yt-paper-button, yt-button-shape button, a")];
        const hit = btns.find(exact);
        if (hit) return hit;
      }
      // last resort: the section's own single button
      return document.querySelector("ytd-video-description-transcript-section-renderer button");
    };

    // The description section can still be hydrating, especially right after a
    // YouTube SPA navigation (the extension can run before the new page's
    // description has rendered at all). One 900ms retry wasn't always enough
    // (confirmed live 2026-08 on a video where the button existed but the
    // extension's diagnostic showed the panel never opened); poll longer instead
    // of giving up after a single check.
    say(0.12, "looking for the Show transcript button");
    let btn = findBtn();
    for (let i = 0; i < 6 && !btn; i++) {
      say(0.12 + (i / 6) * 0.1, `waiting for the description to render (${i + 1}/6)`);
      await YC.sleep(500);
      btn = findBtn();
    }
    if (!btn) { say(1, "no Show transcript button on this video"); return false; }

    YC.trace("panel.button", {
      tag: btn.tagName.toLowerCase(),
      text: (btn.textContent || "").trim().slice(0, 80),
      ariaLabel: (btn.getAttribute("aria-label") || "").slice(0, 80),
    });

    say(0.24, "clicking Show transcript");
    btn.click();
    await YC.sleep(900);
    // the panel can open on the Timeline tab, so select Transcript before waiting
    await YC.selectTranscriptChip();
    say(0.27, "asking YouTube to trigger its transcript loader");
    if (await YC.primeTranscriptContinuation()) {
      say(1, "YouTube loaded the lines");
      return true;
    }
    const deadline = Date.now() + 8000;
    for (let i = 0; i < 25 && Date.now() < deadline; i++) {
      await YC.sleep(320);
      if (YC.fromPanel()) { say(1, "lines are in"); return true; }
      if (i === 8) {
        say(0.28 + (i / 25) * 0.68, "still empty, re-selecting the Transcript tab");
        await YC.selectTranscriptChip();   // retry once as it renders
      } else {
        say(0.28 + (i / 25) * 0.68, `waiting for YouTube to load the lines (${i + 1}/25)`);
      }
    }
    const found = !!YC.fromPanel();
    YC.trace("panel.open.done", { branch: "clicked-show-transcript", found });
    return found;
  },

  /* YouTube virtualises the transcript list: for a long video only the visible
     rows exist in the DOM. So scroll the panel and accumulate rows until the last
     timestamp we have seen reaches the video's duration (or nothing new arrives).
     Progress is measured against the video's real duration, which makes the bar
     and the ETA honest rather than decorative. */
  async harvestPanel(onProgress) {
    const duration = YC.videoDuration();
    const seen = new Map();
    const started = Date.now();
    const absorb = () => { for (const r of YC.fromPanel() || []) if (!seen.has(r.t)) seen.set(r.t, r.text); };

    const scroller =
      document.querySelector("ytd-transcript-segment-list-renderer #segments-container")?.parentElement ||
      document.querySelector("ytd-transcript-segment-list-renderer") ||
      document.querySelector("ytd-engagement-panel-section-list-renderer[target-id*='transcript'] #content");

    YC.trace("panel.harvest.start", {
      duration,
      scroller: scroller ? {
        tag: scroller.tagName.toLowerCase(),
        id: scroller.id || "",
        className: String(scroller.className || "").slice(0, 120),
        height: scroller.scrollHeight || 0,
      } : null,
    });

    absorb();
    let stalls = 0, lastCount = seen.size;
    for (let i = 0; i < 400 && stalls < 6; i++) {
      const maxT = seen.size ? Math.max(...seen.keys()) : 0;
      if (duration && maxT >= duration - 12) break;      // reached the end
      if (onProgress) {
        // Position in the video is the honest measure of progress, but a live or
        // still-loading player can report duration 0, which used to pin frac at 0
        // and freeze the bar for the whole harvest. Fall back to scroll passes so
        // it still visibly advances, capped low so it cannot pretend to be nearly
        // done when we genuinely do not know how much is left.
        const frac = duration ? Math.min(0.99, maxT / duration) : Math.min(0.9, i / 60);
        const elapsed = (Date.now() - started) / 1000;
        const eta = duration && frac > 0.04 ? Math.max(0, Math.round(elapsed / frac - elapsed)) : null;
        onProgress(frac, seen.size, eta);
      }
      if (!scroller) break;
      scroller.scrollTop = scroller.scrollHeight;         // pull in the next window
      await YC.sleep(140);
      absorb();
      if (seen.size === lastCount) stalls++; else { stalls = 0; lastCount = seen.size; }
    }
    absorb();
    if (onProgress) onProgress(1, seen.size, 0);
    const result = [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([t, text]) => ({ t, text }));
    YC.trace("panel.harvest.done", {
      rows: result.length,
      stalls,
      elapsedMs: Date.now() - started,
      lastTimestamp: result.length ? result[result.length - 1].t : null,
    });
    return result;
  },

  /* Ask youchop.app to fetch it. Used when the local paths are unavailable. */
  async fromApi(videoId, lang) {
    YC.trace("youchop.api.request", { videoId, lang: lang || "en" });
    const r = await fetch("https://youchop.app/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [videoId], lang: lang || "en", timestamps: true }),
    });
    YC.trace("youchop.api.response", { status: r.status, ok: r.ok });
    const raw = await r.text();
    YC.trace("youchop.api.body", { bytes: raw.length, nonWhitespace: raw.trim().length });
    if (!r.ok) throw new Error(`youchop API HTTP ${r.status}`);
    if (!raw.trim()) throw new Error("youchop API returned an empty response");
    let d;
    try { d = JSON.parse(raw); }
    catch { throw new Error("youchop API returned invalid JSON"); }
    const t = d?.transcripts?.[0];
    if (!t?.ok || !t.text) throw new Error("no transcript available for this video");
    // the API returns "[m:ss] line" rows when timestamps are requested
    const rows = t.text.split("\n").map((line) => {
      const m = line.match(/^\[(\d+):(\d{2})(?::(\d{2}))?\]\s*(.*)$/);
      if (!m) return { t: 0, text: line.trim() };
      const sec = m[3] ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
      return { t: sec, text: (m[4] || "").trim() };
    }).filter((r) => r.text);
    YC.trace("youchop.api.parsed", { ok: !!t.ok, rows: rows.length, hasTitle: !!t.title, hasAuthor: !!t.author });
    return { rows, title: t.title || "", author: t.author || "" };
  },

  /* Real chapters (creator-added via description timestamps, or YouTube's own
     auto-chapters) render as an engagement panel whose target-id contains
     "macro-markers" (confirmed live 2026-08, several videos, while debugging the
     transcript panel elsewhere in this file).
     NOT a signal: .ytp-chapters-container / .ytp-chapter-hover-container. Despite
     the name, that's just the seekbar's generic progress-bar/hover scaffolding,
     rendered on every video whether it has chapters or not (confirmed live
     2026-08 on a video with zero chapters, in this same file, on the exact video
     used to test hasChapters() itself: it always exists with one child). Using it
     made hasChapters() return true universally, hiding the "Make chapters" button
     on every video, which is what actually got noticed and reported. */
  hasChapters() {
    if (document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="macro-markers"]')) return true;
    if (document.querySelector("ytd-macro-markers-list-item-renderer")) return true;
    const description = [
      document.querySelector("#description-inline-expander"),
      document.querySelector("ytd-watch-metadata #description"),
    ].filter(Boolean).map((node) => node.innerText || node.textContent || "").join("\n");
    return YC.textHasChapterSequence(description);
  },

  textHasChapterSequence(text) {
    const starts = [];
    for (const line of String(text || "").split(/\r?\n/)) {
      const match = line.match(/^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+\S/);
      if (!match) continue;
      const start = YC.toSec(match[1]);
      if (start !== null) starts.push(start);
    }
    if (starts.length < 3 || starts[0] !== 0) return false;
    return starts.every((start, index) => index === 0 || start - starts[index - 1] >= 10);
  },

  /* Ask youchop.app to turn this video's transcript into paste-ready chapters.
     Only meaningful when hasChapters() is false; the endpoint itself re-checks
     server-side and refuses (cheaply, before spending transcript quota) if the
     video already has real chapters, so this stays correct even if the DOM
     signal above was wrong or stale. */
  async fetchChapters(videoId, segs = null, meta = null) {
    const payload = { id: videoId };
    if (Array.isArray(segs) && segs.length) {
      payload.segments = segs.map((s) => ({
        start: Math.max(0, Math.floor(Number(s.t ?? s.start) || 0)),
        text: String(s.text || "").replace(/\s+/g, " ").trim(),
      })).filter((s) => s.text);
      payload.meta = {
        title: String(meta?.title || "").slice(0, 500),
        author: String(meta?.author || "").slice(0, 500),
        duration: Math.max(0, Math.floor(Number(meta?.duration) || 0)),
      };
    }
    const r = await fetch("https://youchop.app/api/chapterize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await r.text();
    let d = null;
    try { d = JSON.parse(raw); } catch {}
    if (!r.ok) throw new Error((d && (d.message || d.error)) || `chapterize HTTP ${r.status}`);
    if (!d) throw new Error("empty response from chapterize");
    return d;
  },

  async fetchPlaylistVideos(listId) {
    // Prefer the signed-in page that the user can already see. This is required
    // for private and unlisted playlists: an anonymous Vercel request correctly
    // receives "playlist does not exist", while the authenticated YouTube tab
    // has the full rows rendered locally. It also avoids a needless network hop
    // for public playlists.
    const local = YC.playlistVideosFromPage(listId);
    if (local?.videos?.length) return local;

    const r = await fetch(
      "https://youchop.app/api/playlist-videos?listId=" + encodeURIComponent(listId)
    );
    const raw = await r.text();
    let d = null;
    try { d = JSON.parse(raw); } catch {}
    if (!r.ok) throw new Error((d && (d.message || d.error)) || `playlist listing HTTP ${r.status}`);
    if (!d?.videos?.length) throw new Error("playlist has no public videos");
    return d;
  },

  playlistVideosFromPage(listId, root = (typeof document !== "undefined" ? document : null)) {
    if (!root?.querySelectorAll) return null;
    const rows = [...root.querySelectorAll(
      "ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer"
    )];
    const seen = new Set();
    const videos = [];
    for (const row of rows) {
      const titleLink = row.querySelector?.("a#video-title") ||
        row.querySelector?.('a[href*="/watch?v="]');
      const videoId = YC.videoIdFrom(titleLink?.href || titleLink?.getAttribute?.("href") || "");
      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);
      const durationNode = row.querySelector?.(
        "ytd-thumbnail-overlay-time-status-renderer #text, " +
        "ytd-thumbnail-overlay-time-status-renderer, .yt-badge-shape__text"
      );
      const durationMatch = String(durationNode?.textContent || durationNode?.innerText || "")
        .match(/\b\d{1,3}:\d{2}(?::\d{2})?\b/);
      videos.push({
        videoId,
        title: String(
          titleLink?.getAttribute?.("title") || titleLink?.textContent || titleLink?.innerText || videoId
        ).replace(/\s+/g, " ").trim(),
        seconds: durationMatch ? YC.toSec(durationMatch[0]) : null,
        published: null,
      });
    }
    if (!videos.length) return null;

    const titleNode = root.querySelector?.(
      "yt-page-header-renderer h1, ytd-playlist-header-renderer h1, " +
      "yt-page-header-view-model h1, #title yt-formatted-string"
    );
    const pageTitle = String(root.title || "").replace(/\s*-\s*YouTube\s*$/i, "").trim();
    return {
      playlist: {
        id: listId,
        title: String(titleNode?.textContent || titleNode?.innerText || pageTitle || "YouTube playlist")
          .replace(/\s+/g, " ").trim(),
      },
      videos,
      truncated: false,
      via: "browser-local",
    };
  },

  async extractPlaylistVideo(videoId, lang = "en", jobId = "") {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      throw new Error("extension runtime unavailable");
    }
    const result = await chrome.runtime.sendMessage({
      type: "youchop-extract-video",
      videoId,
      lang,
      jobId,
    });
    if (!result?.ok) throw new Error(result?.error || "playlist video extraction failed");
    return result;
  },

  /* Tries, in order: YouTube's open transcript panel, the panel's same-origin
     get_transcript continuation, the caption endpoint directly, then youchop.app.
     The first three are free and local; only the final provider path spends quota. */
  async extract(videoId, format = "clean", lang = "en", onProgress = null, options = {}) {
    let meta = { videoId, title: document.title.replace(/ - YouTube$/, ""), author: "", duration: YC.videoDuration() };
    let segs = null, source = null;
    YC.resetTrace({
      runtime: YC.runtimeVersion(),
      videoId,
      page: location.href,
      duration: meta.duration,
      language: lang,
    });
    YC.lastPanelStrategy = null;
    YC.lastEndpointResult = null;
    YC.lastEndpointError = null;
    YC.lastTranscriptNote = null;
    YC.lastCaptionNote = null;

    if (!options.refresh) {
      const cached = await YC.readTranscriptCache(videoId, lang);
      if (cached) {
        meta = { ...meta, ...cached.meta, videoId };
        segs = cached.segs;
        source = "browser-cache";
        YC.trace("path.browser_cache.success", {
          rows: segs.length,
          ageSeconds: Math.max(0, Math.floor((Date.now() - cached.savedAt) / 1000)),
          originalSource: cached.originalSource,
        });
        if (onProgress) onProgress(1, segs.length, 0, "loaded saved transcript");
        return { text: YC.render(segs, meta, format), meta, segs, source };
      }
      YC.trace("path.browser_cache.miss", { videoId, lang });
    }

    // Preferred path: YouTube's own transcript panel. Free, local, and it is the
    // one path confirmed working, because YouTube fetched the data itself with
    // valid tokens and we only read the rendered DOM.
    // The extraction paths share slices of the bar, so a chop that falls through
    // to a later path keeps moving forward instead of jumping back to a lower
    // percentage: opening 0-25%, reading rows 25-100%, and the two fallbacks
    // filling the same band when the panel path yields nothing.
    if (onProgress) onProgress(0, 0, null, "opening transcript");
    const opened = await YC.openPanel(onProgress ? (f, m) => onProgress(f * 0.25, 0, null, m) : null);
    YC.trace("panel.open.result", { opened, strategy: YC.lastPanelStrategy || "none" });
    if (opened) {
      segs = await YC.harvestPanel(
        onProgress ? (f, n, eta) => onProgress(0.25 + f * 0.75, n, eta, "reading transcript") : null
      );
      if (segs?.length) {
        source = "panel";
        YC.trace("path.panel.success", { rows: segs.length });
        // fill in author/title from the page, since we skipped the player response
        const ch = document.querySelector("#owner #channel-name a, ytd-channel-name#channel-name a");
        if (ch) meta.author = ch.textContent.trim();
        const h1 = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string");
        if (h1?.textContent.trim()) meta.title = h1.textContent.trim();
      }
    }

    // If the panel is expanded but stuck on its continuation spinner, use the
    // exact same authenticated YouTube endpoint the panel was trying to call.
    // This is still local and free, unlike the final youchop.app provider path.
    if (!segs?.length) {
      const p = (f, m) => { if (onProgress) onProgress(f, 0, null, m); };
      p(0.3, "panel stalled, asking YouTube directly");
      try {
        const s = await YC.fetchTranscriptContinuation();
        if (s.length) {
          segs = s; source = "youtube-transcript";
          YC.lastTranscriptNote = `${s.length} lines`;
          p(0.58, `got ${s.length} lines from YouTube`);
        }
      } catch (e) {
        YC.lastTranscriptNote = String(e.message || e).slice(0, 100);
        YC.trace("path.youtube_transcript.failed", { error: YC.lastTranscriptNote });
        p(0.5, "YouTube transcript request failed");
      }
    }

    if (!segs?.length) {
      const p = (f, m) => { if (onProgress) onProgress(f, 0, null, m); };
      p(0.3, "panel gave nothing, trying captions directly");
      try {
        p(0.34, "fetching the video page");
        const pr = await YC.playerResponse(videoId);
        meta = YC.meta(pr);
        p(0.42, "looking for a caption track");
        const track = YC.pickTrack(pr, lang);
        YC.trace("captions.track.selected", track ? {
          language: track.languageCode || "unknown",
          kind: track.kind || "human",
          name: YC.textValue(track.name).slice(0, 60),
        } : { track: null });
        if (!track) { YC.lastCaptionNote = "video has no caption tracks"; p(0.5, "no caption track on this video"); }
        else {
          p(0.46, `downloading ${track.languageCode || lang} captions${track.kind === "asr" ? " (auto-generated)" : ""}`);
          const s = await YC.fetchTrack(track);
          if (s.length) { segs = s; source = "captions"; YC.lastCaptionNote = `${s.length} lines`; p(0.58, `got ${s.length} lines`); }
          else { YC.lastCaptionNote = "endpoint returned empty (PoToken bot-gate)"; p(0.5, "YouTube returned an empty caption file"); }
        }
      } catch (e) {
        YC.lastCaptionNote = String(e.message || e).slice(0, 60);
        YC.trace("path.captions.failed", { error: String(e.message || e).slice(0, 240) });
        p(0.5, "caption fetch failed");
      }
    }

    if (!segs && options.localOnly) {
      throw new Error(
        "Local YouTube extraction returned no transcript. Open this video normally, confirm Show transcript works, then retry the playlist."
      );
    }

    if (!segs) {
      if (onProgress) onProgress(0.6, 0, null, "asking youchop.app (last resort)");
      try {
        const api = await YC.fromApi(videoId, lang);
        segs = api.rows; source = "youchop.app";
        if (api.title) meta.title = api.title;
        if (api.author) meta.author = api.author;
      } catch (e) {
        // Every path failed. Report what each one actually saw instead of guessing
        // at a cause, so the failure is diagnosable rather than mysterious.
        YC.trace("path.youchop.failed", { error: String(e.message || e).slice(0, 240) });
        const d = YC.panelDiagnostics();
        YC.trace("failure.dom_snapshot", d);
        const net = /failed to fetch|networkerror|load failed/i.test(String(e.message || e));
        const err = new Error(
          "Could not read the transcript.\n" +
          `runtime: ${YC.runtimeVersion()}\n` +
          `page: ${location.href}\n` +
          `panels: ${d.transcriptPanels}\n` +
          `visible panel: ${d.visiblePanel}  chips: ${d.chips}\n` +
          `panel details: ${JSON.stringify(d.panelDetails)}\n` +
          `elements: ${d.segmentEls} segment, ${d.classVariants} class-variant\n` +
          `timestamp rows in page: ${d.timestampRowsFound} (under <${d.timestampRowsUnder}>, ${d.timestampGroups} groups), filtered stamp-only: ${d.stampOnly}, raw stamp-only: ${d.rawStampOnly}\n` +
          `strategy: ${d.strategy}\n` +
          `YouTube transcript endpoint: ${YC.lastTranscriptNote || "not reached"}\n` +
          `captions: ${YC.lastCaptionNote || "not reached"}\n` +
          `youchop.app: ${net ? "BLOCKED. Remove and re-add the extension so Chrome grants the new host permission (a plain reload does not always do it)." : String(e.message || e)}\n` +
          (d.timestampRowsFound === 0
            ? "No timestamped rows exist in the page at all, so the transcript is not open. Click Show transcript under the video, confirm you can see the lines, then click Chop."
            : "Timestamped rows exist but were not recognised; send this text.") +
          `\n\ndebug trace:\n${YC.formatTrace()}`
        );
        err.diagnostics = d;
        throw err;
      }
    }

    if (!segs?.length) throw new Error("no transcript available for this video");
    const saved = await YC.saveTranscriptCache(videoId, lang, segs, meta, source);
    YC.trace("path.browser_cache.write", { saved, rows: segs.length });
    YC.trace("extract.success", { source, rows: segs.length, titleChars: meta.title.length, authorChars: meta.author.length });
    return { text: YC.render(segs, meta, format), meta, segs, source };
  },
};

if (typeof module !== "undefined") module.exports = YC;
