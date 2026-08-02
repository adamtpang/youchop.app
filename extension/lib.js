/* lib.js, transcript extraction, shared by the content script and popup.
 *
 * The whole trick: this runs in the user's own browser on their own residential
 * IP, so YouTube serves captions normally. No API key, no proxy, no server, and
 * nothing leaves the machine. This is the path that datacenter-hosted scrapers
 * cannot take, and it is why the extension is the cheapest possible extractor.
 */

/* `var`, not `const`, on purpose: the service worker re-runs this file inside tabs
   that are already open when the extension updates. `const` would throw "already
   declared" and leave the stale build in place; `var` replaces the object, and the
   running content script picks the new one up because it looks YC up globally. */
var YC = {
  BUILD: "0.7.0",
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
    const hits = YC.timestampRows();
    if (hits.rows.length >= 5) {
      YC.lastPanelStrategy = `structural (${hits.rows.length} rows under ${hits.where})`;
      return hits.rows;
    }

    YC.lastPanelStrategy = null;
    return null;
  },

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
      // Climb past wrappers that add nothing, so `row` is the first ancestor that
      // holds words as well as the stamp.
      let stampEl = el, row = el.parentElement;
      while (row && (row.textContent || "").trim() === txt) { stampEl = row; row = row.parentElement; }
      if (!row) continue;
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
      rows.push({ t: sec, text: r.text });
    }
    rows.sort((a, b) => a.t - b.t);
    return { rows, where: bestSig ? bestSig.split("|")[0].toLowerCase() : "none", groups: bySig.size };
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
  stampOnlyCount() {
    let n = 0;
    for (const el of document.querySelectorAll("span, div, button, yt-formatted-string, a")) {
      if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test((el.textContent || "").trim())) n++;
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
      strategy: YC.lastPanelStrategy || "none matched",
      duration: YC.videoDuration(),
    };
  },

  /* Open YouTube's transcript panel if it is not already showing, so the user
     only has to click once. Needs the description expanded first, because that is
     where the button lives. */
  /* There is more than one transcript panel in the DOM. Browser inspection of a
     live watch page (2026-08) found both `PAmodern_transcript_view` and
     `engagement-panel-searchable-transcript`, and the first one in document order
     was HIDDEN. Taking querySelector's first match therefore inspected the wrong
     panel and reported "present (HIDDEN)" while the real one was expanded. */
  visibleTranscriptPanel() {
    const panels = [...document.querySelectorAll("ytd-engagement-panel-section-list-renderer")]
      .filter((p) => /transcript/i.test(p.getAttribute("target-id") || ""));
    return panels.find((p) => !/HIDDEN/i.test(p.getAttribute("visibility") || "")) || panels[0] || null;
  },

  /* The panel is tabbed: a chip bar offers "Timeline" and "Transcript", and it can
     open on Timeline, in which case no transcript rows exist yet. Select the
     Transcript chip if one is present. */
  async selectTranscriptChip() {
    const panel = YC.visibleTranscriptPanel();
    if (!panel) return false;
    const chip = [...panel.querySelectorAll("chip-view-model, button, div[role='tab'], [role='tab']")]
      .find((c) => /^transcript$/i.test((c.textContent || "").trim()));
    if (!chip) return false;
    const already = /true/i.test(chip.getAttribute("aria-selected") || "");
    if (!already) { chip.click(); await YC.sleep(900); }
    return true;
  },

  async openPanel() {
    if (YC.fromPanel()) return true;

    // panel may already be open but showing the Timeline tab
    if (YC.visibleTranscriptPanel()) {
      await YC.selectTranscriptChip();
      for (let i = 0; i < 12; i++) { await YC.sleep(300); if (YC.fromPanel()) return true; }
    }

    // The button lives inside the (collapsed) description, so expand that first.
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

    let btn = findBtn();
    if (!btn) {                      // description may still be rendering
      await YC.sleep(900);
      btn = findBtn();
    }
    if (!btn) return false;

    btn.click();
    await YC.sleep(900);
    // the panel can open on the Timeline tab, so select Transcript before waiting
    await YC.selectTranscriptChip();
    for (let i = 0; i < 25; i++) {
      await YC.sleep(320);
      if (YC.fromPanel()) return true;
      if (i === 8) await YC.selectTranscriptChip();   // retry once as it renders
    }
    return !!YC.fromPanel();
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

    absorb();
    let stalls = 0, lastCount = seen.size;
    for (let i = 0; i < 400 && stalls < 6; i++) {
      const maxT = seen.size ? Math.max(...seen.keys()) : 0;
      if (duration && maxT >= duration - 12) break;      // reached the end
      if (onProgress) {
        const frac = duration ? Math.min(0.99, maxT / duration) : 0;
        const elapsed = (Date.now() - started) / 1000;
        const eta = frac > 0.04 ? Math.max(0, Math.round(elapsed / frac - elapsed)) : null;
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
    return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([t, text]) => ({ t, text }));
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
  async extract(videoId, format = "clean", lang = "en", onProgress = null) {
    let meta = { videoId, title: document.title.replace(/ - YouTube$/, ""), author: "", duration: YC.videoDuration() };
    let segs = null, source = null;

    // Preferred path: YouTube's own transcript panel. Free, local, and it is the
    // one path confirmed working, because YouTube fetched the data itself with
    // valid tokens and we only read the rendered DOM.
    if (onProgress) onProgress(0, 0, null, "opening transcript");
    if (await YC.openPanel()) {
      segs = await YC.harvestPanel(
        onProgress ? (f, n, eta) => onProgress(f, n, eta, "reading transcript") : null
      );
      if (segs?.length) {
        source = "panel";
        // fill in author/title from the page, since we skipped the player response
        const ch = document.querySelector("#owner #channel-name a, ytd-channel-name#channel-name a");
        if (ch) meta.author = ch.textContent.trim();
        const h1 = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string");
        if (h1?.textContent.trim()) meta.title = h1.textContent.trim();
      }
    }

    if (!segs?.length) {
      if (onProgress) onProgress(0.3, 0, null, "reading captions");
      try {
        const pr = await YC.playerResponse(videoId);
        meta = YC.meta(pr);
        const track = YC.pickTrack(pr, lang);
        if (!track) { YC.lastCaptionNote = "video has no caption tracks"; }
        else {
          const s = await YC.fetchTrack(track);
          if (s.length) { segs = s; source = "captions"; YC.lastCaptionNote = `${s.length} lines`; }
          else YC.lastCaptionNote = "endpoint returned empty (PoToken bot-gate)";
        }
      } catch (e) { YC.lastCaptionNote = String(e.message || e).slice(0, 60); }
    }

    if (!segs) {
      if (onProgress) onProgress(0.6, 0, null, "asking youchop.app");
      try {
        const api = await YC.fromApi(videoId, lang);
        segs = api.rows; source = "youchop.app";
        if (api.title) meta.title = api.title;
        if (api.author) meta.author = api.author;
      } catch (e) {
        // Every path failed. Report what each one actually saw instead of guessing
        // at a cause, so the failure is diagnosable rather than mysterious.
        const d = YC.panelDiagnostics();
        const net = /failed to fetch|networkerror|load failed/i.test(String(e.message || e));
        const err = new Error(
          "Could not read the transcript.\n" +
          `panels: ${d.transcriptPanels}\n` +
          `visible panel: ${d.visiblePanel}  chips: ${d.chips}\n` +
          `elements: ${d.segmentEls} segment, ${d.classVariants} class-variant\n` +
          `timestamp rows in page: ${d.timestampRowsFound} (under <${d.timestampRowsUnder}>, ${d.timestampGroups} groups), stamp-only elements: ${d.stampOnly}\n` +
          `strategy: ${d.strategy}\n` +
          `captions: ${YC.lastCaptionNote || "not reached"}\n` +
          `youchop.app: ${net ? "BLOCKED. Remove and re-add the extension so Chrome grants the new host permission (a plain reload does not always do it)." : String(e.message || e)}\n` +
          (d.timestampRowsFound === 0
            ? "No timestamped rows exist in the page at all, so the transcript is not open. Click Show transcript under the video, confirm you can see the lines, then click Chop."
            : "Timestamped rows exist but were not recognised; send this text.")
        );
        err.diagnostics = d;
        throw err;
      }
    }

    if (!segs?.length) throw new Error("no transcript available for this video");
    return { text: YC.render(segs, meta, format), meta, segs, source };
  },
};

if (typeof module !== "undefined") module.exports = YC;
