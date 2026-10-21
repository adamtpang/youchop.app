/* content.js, injects the one-click Chop button into YouTube's own action row
   and renders the result in a panel. Deep audio transcription uses the loopback service. */
(function () {
  "use strict";
  const CONTENT_BUILD = typeof YC !== "undefined" ? YC.BUILD : "unknown";
  // A current script is a no-op. A newer script can cleanly replace a previous
  // upgrade-aware build without stacking observers, intervals, or message
  // listeners. Builds older than 0.10.3 have no cleanup hook; background.js
  // reloads those tabs once during this update.
  if (window.__youchopWired && window.__youchopContentBuild === CONTENT_BUILD) return;
  if (window.__youchopWired && typeof window.__youchopContentCleanup === "function") {
    try { window.__youchopContentCleanup(); } catch {}
  } else if (window.__youchopWired) {
    return;
  }
  window.__youchopWired = true;
  window.__youchopContentBuild = CONTENT_BUILD;
  const BTN_ID = "youchop-btn";
  const PLAYLIST_BTN_ID = "youchop-playlist-btn";
  const PANEL_ID = "youchop-panel";
  const PLAYLIST_LIMIT = 50;
  let lastVideoId = null;
  let playlistRun = 0;
  let activePlaylistJob = null;

  const $ = (s, r = document) => r.querySelector(s);

  function firstVisible(selectors) {
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const rect = element.getBoundingClientRect?.();
        const style = getComputedStyle(element);
        if (rect && rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
          return element;
        }
      }
    }
    return null;
  }

  function currentVideoId() {
    return YC.videoIdFrom(location.href);
  }

  function currentPlaylistId() {
    return YC.playlistIdFrom(location.href);
  }

  /* ---------- panel ---------- */
  function closePanel() {
    playlistRun++;
    if (activePlaylistJob) {
      chrome.runtime.sendMessage({
        type: "youchop-cancel-playlist",
        jobId: activePlaylistJob,
      }).catch(() => {});
      activePlaylistJob = null;
    }
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
  }

  function panel() {
    closePanel();
    const el = document.createElement("div");
    el.id = PANEL_ID;
    el.innerHTML = `
      <div class="yc-head">
        <span class="yc-brand">You<span class="yc-blade"></span>Chop</span>
        <span class="yc-ver" id="yc-ver"></span>
        <span class="yc-meta" id="yc-meta"></span>
        <button class="yc-x" id="yc-close" title="Close">&times;</button>
      </div>
      <div class="yc-prog" id="yc-prog">
        <div class="yc-prog-track"><div class="yc-prog-fill" id="yc-prog-fill"></div></div>
        <div class="yc-prog-label" id="yc-prog-label">Starting...</div>
      </div>
      <div class="yc-deep" id="yc-deep" style="display:none">
        <p id="yc-deep-note" role="status" aria-live="polite"></p>
        <button class="yc-btn amber" id="yc-deep-button">Deep transcribe</button>
      </div>
      <div class="yc-bar" id="yc-controls" style="display:none">
        <div class="yc-seg" id="yc-fmt">
          <button data-f="clean" class="on">Clean text</button>
          <button data-f="timestamps">Timestamps</button>
          <button data-f="markdown">Markdown</button>
        </div>
        <div class="yc-actions">
          <button class="yc-btn amber" id="yc-chapters" style="display:none">Make chapters for comment</button>
          <button class="yc-btn ghost" id="yc-download">Download</button>
          <button class="yc-btn red" id="yc-copy">Copy</button>
        </div>
      </div>
      <div class="yc-docbar" id="yc-docbar" style="display:none">
        <label for="yc-doc-select">Transcript file</label>
        <select id="yc-doc-select" aria-label="Playlist transcript file"></select>
        <span id="yc-doc-count"></span>
      </div>
      <textarea class="yc-out" id="yc-out" readonly></textarea>
      <div class="yc-foot" id="yc-foot"></div>`;
    (document.fullscreenElement || document.body).appendChild(el);
    // Always show the running build. A stale content script is invisible otherwise:
    // reloading the extension does not replace scripts already injected into open
    // tabs, so an old version can keep answering long after the files changed.
    $("#yc-ver", el).textContent = "v" + (typeof YC !== "undefined" ? YC.BUILD : "?");
    $("#yc-close", el).onclick = closePanel;
    return el;
  }

  function toast(msg) {
    const f = document.getElementById("yc-foot");
    if (f) { f.textContent = msg; setTimeout(() => { if (f.textContent === msg) f.textContent = ""; }, 2200); }
  }

  /* ---------- the click ---------- */
  async function chop() {
    const id = currentVideoId();
    if (!id) return;
    const el = panel();
    const out = $("#yc-out", el);
    out.value = "";
    let state = { segs: null, meta: null, format: "timestamps" };

    const fill = $("#yc-prog-fill", el);
    const plabel = $("#yc-prog-label", el);
    // The bar must never go backwards. Each path reports within its own band, but
    // a retry inside a wait loop can re-report a slightly lower fraction, and a bar
    // that slides back reads as "something broke" even when it is fine.
    let shownFrac = 0;
    const onProgress = (frac, count, eta, stage) => {
      shownFrac = Math.max(shownFrac, Math.max(0.02, frac));
      fill.style.width = Math.round(shownFrac * 100) + "%";
      const pct = Math.round(shownFrac * 100);
      const etaTxt = eta == null ? "" : eta > 0 ? ` · about ${eta}s left` : " · almost done";
      // Steps already carry their own detail (a counter, a parenthetical), so only
      // add the trailing ellipsis to a bare stage name.
      const label = /[)\d.]$/.test(stage) ? stage : stage + "…";
      plabel.textContent = `${pct}% · ${label}${count ? ` · ${count.toLocaleString()} lines` : ""}${etaTxt}`;
    };

    const deepButton = $("#yc-deep-button", el);
    const deepNote = $("#yc-deep-note", el);
    const stillHere = () => el.isConnected && currentVideoId() === id;
    let deepBusy = false;
    async function deepRequest(action, jobId) {
      const response = await chrome.runtime.sendMessage({ type: "youchop-deep-transcribe", action, videoId: id, jobId });
      if (!response?.ok) throw new Error(response?.error || "Reload YouChop and retry Deep transcribe.");
      return response.data;
    }
    deepButton.onclick = async () => {
      if (deepBusy || !stillHere()) return;
      deepBusy = true;
      deepButton.disabled = true;
      deepButton.textContent = "Transcribing…";
      $("#yc-chapters", el).disabled = true;
      deepNote.textContent = "Starting local audio transcription. This can take several minutes. Closing Chop keeps the local job running.";
      try {
        const job = await deepRequest("start");
        while (stillHere()) {
          const status = await deepRequest("status", job.id);
          if (!stillHere()) return;
          if (status.status === "error") throw new Error(status.message);
          if (status.status === "done") {
            const r = status.result;
            if (!r?.segments?.length) throw new Error("No speech was detected in the audio. The original transcript is still shown.");
            const segs = r.segments.map(s => ({ t: s.start, text: s.text }));
            const meta = { videoId: id, title: r.title || state.meta?.title || document.title,
              author: state.meta?.author || "", duration: r.durationSeconds };
            await YC.saveTranscriptCache(id, "en", segs, meta, "local-whisper");
            state.format = "timestamps";
            showResult({ segs, meta, source: "local-whisper", text: YC.render(segs, meta, "timestamps") });
            return;
          }
          deepNote.textContent = `${status.message || "Queued."} Audio stays on this computer. Closing Chop keeps the job running; reopen and press Deep transcribe to reconnect.`;
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        if (stillHere()) deepNote.textContent = error.message || String(error);
      } finally {
        deepBusy = false;
        deepButton.disabled = false;
        deepButton.textContent = "Deep transcribe";
        $("#yc-chapters", el).disabled = YC.hasChapters();
      }
    };

    function showResult(res) {
      if (!el.isConnected || currentVideoId() !== id) return;
      out.readOnly = true;
      $("#yc-foot", el).textContent = "";
      $("#yc-fmt", el).style.visibility = "visible";
      $("#yc-download", el).style.display = "";
      const quality = YC.transcriptReadiness(res.segs, res.meta);
      const hasTiming = res.segs.every(s => Number.isFinite(s.t) && s.t >= 0) && res.segs.some(s => s.t > 0);
      if (!hasTiming) state.format = "clean";
      for (const button of $("#yc-fmt", el).children) {
        button.disabled = !hasTiming && button.dataset.f !== "clean";
        button.title = button.disabled ? "Deep transcribe to create timestamps" : "";
      }
      $("#yc-deep", el).style.display = "flex";
      deepNote.textContent = res.source === "local-whisper"
        ? "Audio processed locally. Machine timestamps and wording may need review."
        : quality.ready ? "Missing speech? Deep transcribe can listen to the audio locally." : quality.reason;
      deepButton.classList.toggle("amber", !quality.ready);
      deepButton.classList.toggle("ghost", quality.ready);
      state.segs = res.segs; state.meta = res.meta;
      // swap the progress bar for the controls
      $("#yc-prog", el).style.display = "none";
      $("#yc-controls", el).style.display = "flex";
      const words = res.text.trim().split(/\s+/).length;
      const via = res.source === "browser-cache" ? "saved transcript"
                : res.source === "panel" || res.source === "youtube-transcript" ? "local, free"
                : res.source === "captions" ? "captions"
                : res.source === "local-whisper" ? "local audio transcription" : "via youchop.app";
      $("#yc-meta", el).textContent =
        `${res.meta.title.slice(0, 46)} · ${words.toLocaleString()} words · ~${Math.round(res.text.length / 4).toLocaleString()} tokens · ${via}`;
      out.value = YC.render(state.segs, state.meta, state.format);
      [...$("#yc-fmt", el).children].forEach(c => c.classList.toggle("on", c.dataset.f === state.format));

      const rerender = () => { out.value = YC.render(state.segs, state.meta, state.format); };
      $("#yc-fmt", el).onclick = (e) => {
        const b = e.target.closest("button[data-f]");
        if (!b) return;
        [...$("#yc-fmt", el).children].forEach((c) => c.classList.toggle("on", c === b));
        state.format = b.dataset.f;
        rerender();
      };
      $("#yc-copy", el).onclick = async () => {
        try { await navigator.clipboard.writeText(out.value); toast("Copied. Paste into Claude."); }
        catch { out.select(); document.execCommand("copy"); toast("Copied."); }
      };
      $("#yc-download", el).onclick = () => {
        const safe = (state.meta.title || "transcript").replace(/[^\w\- ]+/g, "").slice(0, 60).trim() || "transcript";
        const ext = state.format === "markdown" ? "md" : "txt";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([out.value], { type: "text/plain" }));
        a.download = `${safe}.${ext}`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast("Downloaded.");
      };

      const chBtn = $("#yc-chapters", el);
      if (chBtn) {
        const alreadyChapterized = YC.hasChapters();
        chBtn.style.display = alreadyChapterized ? "none" : "";
        if (alreadyChapterized) {
          chBtn.disabled = true;
          chBtn.onclick = null;
          return;
        }
        chBtn.disabled = false;
        chBtn.textContent = "Make chapters for comment";
        chBtn.onclick = async () => {
          chBtn.disabled = true;
          deepButton.disabled = true;
          const original = chBtn.textContent;
          chBtn.textContent = "Generating…";
          try {
            const d = await YC.fetchChapters(id, state.segs, state.meta);
            if (d.pasteWithCredit) {
              // Keep the user in control of the public comment. Show the full
              // attributed block first, make it editable, and copy only after a
              // second explicit click. Nothing is ever posted automatically.
              out.value = d.pasteWithCredit;
              out.readOnly = false;
              $("#yc-fmt", el).style.visibility = "hidden";
              $("#yc-download", el).style.display = "none";
              $("#yc-copy", el).onclick = async () => {
                try { await navigator.clipboard.writeText(out.value); toast("Chapters copied. Paste them yourself."); }
                catch { out.select(); }
              };
              toast(`${d.chapters.length} chapters ready. Edit the attribution if you want.`);
              chBtn.textContent = "Copy chapters";
              chBtn.disabled = false;
              chBtn.onclick = async () => {
                try { await navigator.clipboard.writeText(out.value); toast("Chapters copied. Paste them yourself."); }
                catch { toast("Clipboard blocked."); }
              };
            } else {
              toast("Could not generate chapters.");
              chBtn.textContent = original;
              chBtn.disabled = false;
            }
          } catch (e) {
            toast(String((e && e.message) || e).slice(0, 80));
            chBtn.textContent = original;
            chBtn.disabled = false;
          } finally {
            deepButton.disabled = false;
          }
        };
      }
    }
    try {
      const res = await YC.extract(id, "timestamps", "en", onProgress);
      showResult(res);
    } catch (err) {
      if (!stillHere()) return;
      $("#yc-deep", el).style.display = "flex";
      deepNote.textContent = "No ready transcript. Deep transcribe downloads the audio and creates timestamps locally for free. A missing speech model downloads once.";
      // Persist before rendering. The diagnostic is only in the DOM until the
      // panel closes or YouTube client-navigates away, and a failure hit in
      // passing is exactly the one worth having a record of later.
      // Deliberately not awaited: a storage problem must not stop the user
      // seeing the error, and logFailure already swallows its own.
      YC.logFailure({
        videoId: id,
        title: (state.meta && state.meta.title) || document.title.replace(/ - YouTube$/, ""),
        url: location.href,
        message: String(err.message || err),
        diagnostics: err.diagnostics,
      });

      // put the full diagnostic in the textarea so it can be read and copied,
      // rather than truncating it into the one-line footer
      $("#yc-prog", el).style.display = "none";
      out.value = String(err.message || err);
      $("#yc-meta", el).textContent = "could not extract";
      $("#yc-foot", el).textContent = "Select the text above and copy it to report this.";
      $("#yc-controls", el).style.display = "flex";
      $("#yc-fmt", el).style.visibility = "hidden";
      $("#yc-copy", el).onclick = async () => {
        try { await navigator.clipboard.writeText(out.value); toast("Diagnostics copied."); }
        catch { out.select(); }
      };
      $("#yc-download", el).style.display = "none";
    }
  }

  /* ---------- playlist chop ---------- */
  async function chopPlaylist(listId, queueListing = null) {
    const el = panel();
    const run = ++playlistRun;
    const jobId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    activePlaylistJob = jobId;
    const out = $("#yc-out", el);
    const fill = $("#yc-prog-fill", el);
    const label = $("#yc-prog-label", el);
    out.value = "";
    fill.style.width = "3%";
    label.textContent = "3% · listing playlist videos…";

    try {
      const listing = queueListing || await YC.fetchPlaylistVideos(listId);
      if (run !== playlistRun) return;
      const allVideos = listing.videos || [];
      const videos = allVideos.slice(0, PLAYLIST_LIMIT);
      const playlist = {
        id: listId,
        title: listing.playlist?.title || "YouTube playlist",
      };
      const items = [];
      const failures = [];

      for (let i = 0; i < videos.length; i++) {
        if (run !== playlistRun) return;
        const video = videos[i];
        const pct = 5 + Math.round((i / Math.max(1, videos.length)) * 90);
        fill.style.width = pct + "%";
        label.textContent = `${pct}% · chopping video ${i + 1} of ${videos.length} · ${String(video.title || video.videoId).slice(0, 54)}`;
        try {
          const result = await YC.extractPlaylistVideo(video.videoId, "en", jobId);
          result.meta = result.meta || {};
          result.meta.videoId = result.meta.videoId || video.videoId;
          result.meta.title = result.meta.title || video.title || video.videoId;
          items.push(result);
        } catch (error) {
          failures.push({
            videoId: video.videoId,
            title: video.title || video.videoId,
            error: String(error?.message || error).split("\n")[0].slice(0, 180),
          });
        }
      }

      if (run !== playlistRun) return;
      if (!items.length) {
        throw new Error(`Could not extract any playlist transcripts. ${failures[0]?.error || ""}`.trim());
      }

      let format = "markdown";
      let selectedDocument = 0;
      let documents = [];
      const docbar = $("#yc-docbar", el);
      const docSelect = $("#yc-doc-select", el);
      const docCount = $("#yc-doc-count", el);
      const render = () => {
        documents = YC.playlistDocuments(items, playlist, format);
        selectedDocument = Math.min(selectedDocument, Math.max(0, documents.length - 1));
        docSelect.textContent = "";
        for (let i = 0; i < documents.length; i++) {
          const option = document.createElement("option");
          option.value = String(i);
          option.textContent = documents[i].filename;
          docSelect.appendChild(option);
        }
        docSelect.value = String(selectedDocument);
        const current = documents[selectedDocument];
        out.value = current?.text || "";
        docCount.textContent = documents.length ? `${selectedDocument + 1} of ${documents.length}` : "";
      };
      docSelect.onchange = () => {
        selectedDocument = Math.max(0, Number(docSelect.value) || 0);
        const current = documents[selectedDocument];
        out.value = current?.text || "";
        docCount.textContent = `${selectedDocument + 1} of ${documents.length}`;
      };
      render();
      fill.style.width = "100%";
      $("#yc-prog", el).style.display = "none";
      $("#yc-controls", el).style.display = "flex";
      docbar.style.display = "flex";
      [...$("#yc-fmt", el).children].forEach((b) => b.classList.toggle("on", b.dataset.f === format));
      $("#yc-fmt", el).addEventListener("click", (event) => {
        const button = event.target.closest("button[data-f]");
        if (!button) return;
        [...$("#yc-fmt", el).children].forEach((b) => b.classList.toggle("on", b === button));
        format = button.dataset.f;
        render();
      });

      const words = items.reduce((sum, item) =>
        sum + (item.segs || []).reduce((n, seg) => n + String(seg.text || "").trim().split(/\s+/).filter(Boolean).length, 0), 0);
      $("#yc-meta", el).textContent =
        `${playlist.title.slice(0, 40)} · ${items.length}/${videos.length} videos · ${words.toLocaleString()} words · local, free`;
      $("#yc-copy", el).onclick = async () => {
        const current = documents[selectedDocument];
        try { await navigator.clipboard.writeText(current?.text || out.value); toast(`Copied ${current?.filename || "transcript"}.`); }
        catch { out.select(); }
      };
      $("#yc-download", el).onclick = () => {
        const current = documents[selectedDocument];
        if (!current) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([current.text], { type: "text/plain" }));
        a.download = current.filename;
        a.click();
        URL.revokeObjectURL(a.href);
      };
      $("#yc-chapters", el).style.display = "none";

      const notes = [];
      if (allVideos.length > videos.length) notes.push(`first ${videos.length} of ${allVideos.length} videos`);
      if (listing.truncated) notes.push("playlist listing was truncated");
      if (failures.length) notes.push(`${failures.length} failed`);
      notes.unshift("Choose a transcript file above; Copy and Download apply to that file");
      $("#yc-foot", el).textContent = notes.join(" · ");
    } catch (error) {
      if (run !== playlistRun) return;
      $("#yc-prog", el).style.display = "none";
      out.value = String(error?.message || error);
      $("#yc-meta", el).textContent = "could not chop playlist";
      $("#yc-foot", el).textContent = "Copy this error to report it.";
      $("#yc-controls", el).style.display = "flex";
      $("#yc-fmt", el).style.visibility = "hidden";
      $("#yc-download", el).style.display = "none";
      $("#yc-copy", el).onclick = async () => {
        try { await navigator.clipboard.writeText(out.value); toast("Error copied."); }
        catch { out.select(); }
      };
    } finally {
      if (activePlaylistJob === jobId) activePlaylistJob = null;
      chrome.runtime.sendMessage({
        type: "youchop-finish-playlist",
        jobId,
      }).catch(() => {});
    }
  }

  /* ---------- button injection ---------- */
  function makeButton() {
    const b = document.createElement("button");
    b.id = BTN_ID;
    b.className = "youchop-inject";
    b.textContent = "Chop";
    b.title = "YouChop: extract this video's transcript";
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); chop(); };
    return b;
  }

  function makePlaylistButton(listId) {
    const b = document.createElement("button");
    b.id = PLAYLIST_BTN_ID;
    b.className = "youchop-inject";
    b.textContent = "Chop playlist";
    b.title = "YouChop: extract every transcript in this playlist locally";
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); chopPlaylist(listId); };
    return b;
  }

  async function channelQueue(ref) {
    const el = panel();
    const run = playlistRun;
    $('#yc-prog', el).style.display = 'none';
    $('#yc-out', el).style.display = 'none';
    $('#yc-meta', el).textContent = 'Channel queue';
    const box = document.createElement('div');
    box.className = 'yc-queue';
    box.innerHTML = `
      <p>Choose videos from this channel’s Videos tab. Save the queue here, watch it on YouTube, or chop its transcripts.</p>
      <form id="yc-queue-form">
        <div class="yc-queue-fields">
          <label>Order<select name="sort"><option value="latest">Latest</option><option value="popular">Most popular</option><option value="oldest">Oldest</option></select></label>
          <label>Videos<input name="count" type="number" min="1" max="50" step="1" value="20" required></label>
          <label>Min minutes<input name="min" type="number" min="0" step="any" placeholder="Any"></label>
          <label>Max minutes<input name="max" type="number" min="0" step="any" placeholder="Any"></label>
          <label class="yc-queue-query">Title contains<input name="query" type="search" placeholder="Any topic"></label>
        </div>
        <button class="yc-btn red" type="submit">Build queue</button>
      </form>
      <p id="yc-queue-status" role="status" aria-live="polite">Up to 50 videos. Shorts and live streams are excluded.</p>
      <div class="yc-queue-actions" hidden>
        <button class="yc-btn red" id="yc-queue-watch">Watch queue</button>
        <button class="yc-btn ghost" id="yc-queue-chop">Chop transcripts</button>
        <button class="yc-btn ghost" id="yc-queue-download">Download links</button>
      </div>
      <ol id="yc-queue-list"></ol>`;
    el.insertBefore(box, $('#yc-foot', el));
    const form = $('form', box), status = $('#yc-queue-status', box), list = $('#yc-queue-list', box);
    const actions = $('.yc-queue-actions', box);
    let queue = null, building = false, generation = 0;
    const alive = () => run === playlistRun && el.isConnected;
    const save = async () => {
      try { await chrome.storage.local.set({ 'youchop.channelQueue.v1': queue }); }
      catch { if (alive()) status.textContent += ' Could not save locally; download links to keep this queue.'; }
    };
    const render = () => {
      list.textContent = '';
      actions.hidden = !queue?.videos.length;
      for (const video of queue?.videos || []) {
        const row = document.createElement('li');
        const link = document.createElement('a');
        link.href = 'https://www.youtube.com/watch?v=' + video.videoId;
        link.target = '_blank'; link.rel = 'noopener'; link.textContent = video.title;
        const duration = document.createElement('span');
        duration.textContent = video.seconds == null ? 'Duration unavailable' : `${Math.floor(video.seconds / 60)}:${String(video.seconds % 60).padStart(2, '0')}`;
        const remove = document.createElement('button');
        remove.textContent = 'Remove'; remove.className = 'yc-btn ghost';
        remove.onclick = () => {
          queue.videos = queue.videos.filter(v => v.videoId !== video.videoId);
          status.textContent = `${queue.videos.length} videos in your queue.`;
          render(); save();
        };
        row.append(link, duration, remove); list.appendChild(row);
      }
    };
    form.oninput = () => { generation++; actions.hidden = true; if (!building) status.textContent = 'Build queue to apply your choices.'; };
    form.onsubmit = async event => {
      event.preventDefault();
      if (building) return;
      const options = Object.fromEntries(new FormData(form));
      try { YCQueue.select([], options); } catch (error) { status.textContent = error.message; return; }
      building = true;
      const current = ++generation;
      const submit = $('button[type="submit"]', form);
      submit.disabled = true; actions.hidden = true; list.textContent = '';
      let all = [], cursor = null, title = ref, pages = 0, selected = [];
      const cursors = new Set();
      try {
        do {
          status.textContent = `Finding videos… ${selected.length} matches from ${all.length} checked.`;
          const result = await chrome.runtime.sendMessage({ type: 'youchop-channel-page', options: { ref, sort: options.sort, cursor } });
          if (!alive() || current !== generation) return;
          if (!result?.ok) throw new Error(result?.error || 'Could not list this channel.');
          if (result.title) title = result.title;
          all.push(...result.videos);
          selected = YCQueue.select(all, options);
          cursor = result.cursor;
          if (cursor && cursors.has(cursor)) throw new Error('YouTube repeated a page. Try again later.');
          cursors.add(cursor);
          pages++;
        } while (cursor && selected.length < Number(options.count) && all.length < 2000 && pages < 70);
        queue = { ref, title, options, videos: selected, savedAt: new Date().toISOString() };
        status.textContent = `${selected.length} of ${options.count} requested videos · ${title}. ` +
          (selected.length < Number(options.count) ? (cursor ? `Scan stopped after ${all.length} videos; more may match.` : 'No more matching uploads.') : 'Queue ready.') +
          ' Saved on this browser. Watch opens a temporary YouTube playlist.';
        render(); await save();
      } catch (error) { if (alive()) status.textContent = error.message || 'Could not build queue.'; }
      finally { building = false; submit.disabled = false; if (alive() && current !== generation) status.textContent = 'Choices changed. Build queue again to apply them.'; }
    };
    $('#yc-queue-watch', box).onclick = () => window.open(YCQueue.watchUrl(queue.videos), '_blank', 'noopener');
    $('#yc-queue-chop', box).onclick = () => chopPlaylist(null, { videos: queue.videos, playlist: { title: queue.title + ' · channel queue' } });
    $('#yc-queue-download', box).onclick = () => {
      const text = `# ${queue.title} — queue\n\nSource: https://www.youtube.com/${ref}\n\n` +
        queue.videos.map((v, i) => `${i + 1}. ${v.title}\n   https://www.youtube.com/watch?v=${v.videoId}`).join('\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
      const a = document.createElement('a'); a.href = url; a.download = 'youchop-channel-queue.md'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    try {
      const saved = (await chrome.storage.local.get('youchop.channelQueue.v1'))['youchop.channelQueue.v1'];
      if (alive() && !generation && saved?.ref === ref && Array.isArray(saved.videos)) {
        queue = { ...saved, videos: YCQueue.select(saved.videos, { count: 50 }) };
        for (const [key, value] of Object.entries(saved.options || {})) if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value;
        status.textContent = `${queue.videos.length} saved videos · ${queue.title}. Rebuild to check new uploads. Watch opens a temporary YouTube playlist.`;
        render();
      }
    } catch { /* The builder remains usable when local storage is unavailable. */ }
  }

  function makeChannelButton(ref) {
    const b = document.createElement("button");
    b.id = BTN_ID;
    b.className = "youchop-inject";
    b.textContent = "Build channel queue";
    b.title = "YouChop: choose, watch, or chop this channel’s videos";
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      channelQueue(ref);
    };
    return b;
  }

  function inject() {
    const videoId = currentVideoId();
    const playlistId = currentPlaylistId();
    const channelRef = videoId || playlistId ? null : YC.channelRefFrom(location.href);
    if (!videoId && !playlistId && !channelRef) {
      document.getElementById(BTN_ID)?.remove();
      document.getElementById(PLAYLIST_BTN_ID)?.remove();
      return;
    }

    if (channelRef) {
      // The channel header's action row, where Subscribe and the ... menu live
      const host = firstVisible([
        "yt-flexible-actions-view-model",
        "#channel-header-container #buttons",
        "ytd-c4-tabbed-header-renderer #buttons",
        "#page-header .yt-flexible-actions-view-model-wiz",
      ]);
      if (!host) return;
      const existing = document.getElementById(BTN_ID);
      if (existing && existing.parentElement !== host) existing.remove();
      if (!document.getElementById(BTN_ID)) host.prepend(makeChannelButton(channelRef));
      return;
    }

    if (!videoId && playlistId) {
      // YouTube currently leaves an old, zero-sized page header in the DOM before
      // the visible one. querySelector() picked that hidden action model, so the
      // button technically existed but had a 0x0 box. Select by rendered geometry
      // and relocate any stale hidden button once the real header appears.
      const host = firstVisible([
        "ytd-playlist-header-renderer .metadata-buttons-wrapper",
        "ytd-playlist-header-renderer #top-level-buttons-computed",
        "ytd-playlist-header-renderer #buttons",
        "ytd-playlist-header-renderer #menu",
        "yt-page-header-renderer yt-flexible-actions-view-model",
        "#page-header .yt-flexible-actions-view-model-wiz",
        "yt-flexible-actions-view-model",
      ]);
      if (!host) return;
      const existing = document.getElementById(PLAYLIST_BTN_ID);
      if (existing && existing.parentElement !== host) existing.remove();
      if (!document.getElementById(PLAYLIST_BTN_ID)) host.prepend(makePlaylistButton(playlistId));
      return;
    }

    // Transcript extraction is available regardless of existing chapters.
    // YouTube retains hidden action rows during navigation. Only use a rendered
    // row, and keep Chop available in Shorts/embedded layouts without one.
    const actionHost = /\/(shorts|embed)\//.test(location.pathname) ? null : firstVisible([
      "ytd-watch-metadata #top-level-buttons-computed",
      "#top-level-buttons-computed",
      "ytd-menu-renderer #top-level-buttons",
      "#actions-inner #menu",
      "ytd-watch-metadata #owner",
    ]);
    const floating = !!document.fullscreenElement || !actionHost;
    const host = document.fullscreenElement || actionHost || document.body;
    if (!host) return;
    if (playlistId && actionHost) {
      const playlistButton = document.getElementById(PLAYLIST_BTN_ID) || makePlaylistButton(playlistId);
      if (playlistButton.parentElement !== actionHost) actionHost.prepend(playlistButton);
    }
    const button = document.getElementById(BTN_ID) || makeButton();
    button.classList.toggle("youchop-floating", floating);
    if (button.parentElement !== host) host.prepend(button);
  }

  // YouTube is an SPA: watch for navigation and re-inject
  function watch() {
    // Track the channel too, so walking between two channels swaps the button's
    // target instead of leaving the first channel's handle wired to it.
    const id = [currentVideoId(), currentPlaylistId(), YC.channelRefFrom(location.href)].filter(Boolean).join("|");
    if (id !== lastVideoId) {
      lastVideoId = id;
      closePanel();
      const stale = document.getElementById(BTN_ID);
      if (stale) stale.remove();
      const stalePlaylist = document.getElementById(PLAYLIST_BTN_ID);
      if (stalePlaylist) stalePlaylist.remove();
    }
    inject();
    const openPanel = document.getElementById(PANEL_ID);
    const panelHost = document.fullscreenElement || document.body;
    if (openPanel && openPanel.parentElement !== panelHost) panelHost.appendChild(openPanel);
  }

  // Used only by the service worker's temporary inactive playlist tab. It runs
  // the exact same local extractor as the visible Chop button, then returns the
  // structured rows to the playlist page. It never posts or mutates YouTube.
  const extractCurrentListener = (message, _sender, sendResponse) => {
    if (message?.type !== "youchop-extract-current") return false;
    const id = currentVideoId();
    if (!id || (message.videoId && message.videoId !== id)) {
      sendResponse({ ok: false, error: "temporary tab loaded the wrong video" });
      return false;
    }
    const media = document.querySelector("video");
    const keepPaused = () => {
      try {
        media.muted = true;
        media.autoplay = false;
        media.pause();
      } catch {}
    };
    if (media) {
      keepPaused();
      media.addEventListener("play", keepPaused);
    }
    YC.extract(id, "clean", message.lang || "en", null, { localOnly: true })
      .then((result) => sendResponse({
        ok: true,
        meta: result.meta,
        segs: result.segs,
        source: result.source,
      }))
      .catch((error) => sendResponse({
        ok: false,
        error: String(error?.message || error).slice(0, 16000),
      }))
      .finally(() => media?.removeEventListener("play", keepPaused));
    return true;
  };
  chrome.runtime.onMessage.addListener(extractCurrentListener);
  const navigationListener = () => setTimeout(watch, 400);
  document.addEventListener("yt-navigate-finish", navigationListener);
  document.addEventListener("fullscreenchange", watch);
  const pageObserver = new MutationObserver(() => watch());
  pageObserver.observe(document.documentElement, { childList: true, subtree: true });
  const watchInterval = setInterval(watch, 1500);
  window.__youchopContentCleanup = () => {
    document.removeEventListener("yt-navigate-finish", navigationListener);
    document.removeEventListener("fullscreenchange", watch);
    pageObserver.disconnect();
    clearInterval(watchInterval);
    chrome.runtime.onMessage.removeListener(extractCurrentListener);
    closePanel();
    document.getElementById(BTN_ID)?.remove();
    document.getElementById(PLAYLIST_BTN_ID)?.remove();
    window.__youchopWired = false;
    window.__youchopContentBuild = null;
    window.__youchopContentCleanup = null;
  };
  watch();
})();
