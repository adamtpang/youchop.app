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
  BUILD: "0.8.8",
  videoIdFrom(url) {
    const s = String(url || "");
    const m =
      s.match(/[?&]v=([\w-]{11})/) ||
      s.match(/youtu\.be\/([\w-]{11})/) ||
      s.match(/\/shorts\/([\w-]{11})/) ||
      s.match(/\/embed\/([\w-]{11})/);
    return m ? m[1] : null;
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
        message: String(entry.message || "").slice(0, 4000),
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
    if (!panel) return false;
    const chip = [...panel.querySelectorAll("chip-view-model, button, div[role='tab'], [role='tab']")]
      .find((c) => /^transcript$/i.test((c.textContent || "").trim()));
    if (!chip) return false;
    const already = /true/i.test(chip.getAttribute("aria-selected") || "");
    if (!already) { chip.click(); await YC.sleep(900); }
    return true;
  },

  /* `report(frac, message)` is optional, frac 0..1 across the opening phase only.
     Opening the panel is the slowest, most failure-prone part of a chop and used
     to be a silent ~10-20s dead zone: the caller announced "opening transcript"
     at 0% once, then the polling loops below ran with nothing to show, so the bar
     looked frozen exactly when the user most wants to know something is happening.
     Every wait loop here now ticks, and every step says what it is doing. */
  async openPanel(report = null) {
    const say = (f, m) => { if (report) report(Math.max(0, Math.min(1, f)), m); };

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
      for (let i = 0; i < 30; i++) {
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
      return !!YC.fromPanel();
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

    say(0.24, "clicking Show transcript");
    btn.click();
    await YC.sleep(900);
    // the panel can open on the Timeline tab, so select Transcript before waiting
    await YC.selectTranscriptChip();
    for (let i = 0; i < 25; i++) {
      await YC.sleep(320);
      if (YC.fromPanel()) { say(1, "lines are in"); return true; }
      if (i === 8) {
        say(0.28 + (i / 25) * 0.68, "still empty, re-selecting the Transcript tab");
        await YC.selectTranscriptChip();   // retry once as it renders
      } else {
        say(0.28 + (i / 25) * 0.68, `waiting for YouTube to load the lines (${i + 1}/25)`);
      }
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
    return false;
  },

  /* Ask youchop.app to turn this video's transcript into paste-ready chapters.
     Only meaningful when hasChapters() is false; the endpoint itself re-checks
     server-side and refuses (cheaply, before spending transcript quota) if the
     video already has real chapters, so this stays correct even if the DOM
     signal above was wrong or stale. */
  async fetchChapters(videoId) {
    const r = await fetch("https://youchop.app/api/chapterize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: videoId }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && (d.message || d.error)) || `chapterize HTTP ${r.status}`);
    if (!d) throw new Error("empty response from chapterize");
    return d;
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
    // The three paths get their own slice of the bar, so a chop that falls through
    // to a later path keeps moving forward instead of jumping back to a lower
    // percentage: opening 0-25%, reading rows 25-100%, and the two fallbacks
    // filling the same band when the panel path yields nothing.
    if (onProgress) onProgress(0, 0, null, "opening transcript");
    if (await YC.openPanel(onProgress ? (f, m) => onProgress(f * 0.25, 0, null, m) : null)) {
      segs = await YC.harvestPanel(
        onProgress ? (f, n, eta) => onProgress(0.25 + f * 0.75, n, eta, "reading transcript") : null
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
      const p = (f, m) => { if (onProgress) onProgress(f, 0, null, m); };
      p(0.3, "panel gave nothing, trying captions directly");
      try {
        p(0.34, "fetching the video page");
        const pr = await YC.playerResponse(videoId);
        meta = YC.meta(pr);
        p(0.42, "looking for a caption track");
        const track = YC.pickTrack(pr, lang);
        if (!track) { YC.lastCaptionNote = "video has no caption tracks"; p(0.5, "no caption track on this video"); }
        else {
          p(0.46, `downloading ${track.languageCode || lang} captions${track.kind === "asr" ? " (auto-generated)" : ""}`);
          const s = await YC.fetchTrack(track);
          if (s.length) { segs = s; source = "captions"; YC.lastCaptionNote = `${s.length} lines`; p(0.58, `got ${s.length} lines`); }
          else { YC.lastCaptionNote = "endpoint returned empty (PoToken bot-gate)"; p(0.5, "YouTube returned an empty caption file"); }
        }
      } catch (e) {
        YC.lastCaptionNote = String(e.message || e).slice(0, 60);
        p(0.5, "caption fetch failed");
      }
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
