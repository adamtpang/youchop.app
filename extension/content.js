/* content.js, injects the one-click Chop button into YouTube's own action row
   and renders the result in a panel. All work happens locally in this tab. */
(function () {
  "use strict";
  // Marks the tab as wired so the service worker can re-inject lib.js on update
  // without stacking a second observer and interval on top of this one.
  if (window.__youchopWired) return;
  window.__youchopWired = true;
  const BTN_ID = "youchop-btn";
  const PANEL_ID = "youchop-panel";
  let lastVideoId = null;

  const $ = (s, r = document) => r.querySelector(s);

  function currentVideoId() {
    return YC.videoIdFrom(location.href);
  }

  /* ---------- panel ---------- */
  function closePanel() {
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
      <textarea class="yc-out" id="yc-out" readonly></textarea>
      <div class="yc-foot" id="yc-foot"></div>`;
    document.body.appendChild(el);
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
    let state = { segs: null, meta: null, format: "clean" };

    const fill = $("#yc-prog-fill", el);
    const plabel = $("#yc-prog-label", el);
    const onProgress = (frac, count, eta, stage) => {
      fill.style.width = Math.round(Math.max(0.02, frac) * 100) + "%";
      const pct = Math.round(frac * 100);
      const etaTxt = eta == null ? "" : eta > 0 ? ` · about ${eta}s left` : " · almost done";
      plabel.textContent = `${stage}... ${pct}%${count ? ` · ${count.toLocaleString()} lines` : ""}${etaTxt}`;
    };

    try {
      const res = await YC.extract(id, "clean", "en", onProgress);
      state.segs = res.segs; state.meta = res.meta;
      // swap the progress bar for the controls
      $("#yc-prog", el).style.display = "none";
      $("#yc-controls", el).style.display = "flex";
      const words = res.text.trim().split(/\s+/).length;
      const via = res.source === "panel" ? "local, free"
                : res.source === "captions" ? "captions"
                : "via youchop.app";
      $("#yc-meta", el).textContent =
        `${res.meta.title.slice(0, 46)} · ${words.toLocaleString()} words · ~${Math.round(res.text.length / 4).toLocaleString()} tokens · ${via}`;
      out.value = res.text;

      const rerender = () => { out.value = YC.render(state.segs, state.meta, state.format); };
      $("#yc-fmt", el).addEventListener("click", (e) => {
        const b = e.target.closest("button[data-f]");
        if (!b) return;
        [...$("#yc-fmt", el).children].forEach((c) => c.classList.toggle("on", c === b));
        state.format = b.dataset.f;
        rerender();
      });
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

      // Always offer chapter generation, even on a video that already has
      // chapters ("I should be able to chapterize even if a video has one" —
      // the existing ones might be low quality, auto-generated, or just not as
      // good as what this produces). YC.hasChapters() only adjusts the label,
      // it no longer gates visibility.
      const chBtn = $("#yc-chapters", el);
      if (chBtn) {
        chBtn.style.display = "";
        chBtn.textContent = YC.hasChapters() ? "Make my own chapters" : "Make chapters for comment";
        chBtn.onclick = async () => {
          chBtn.disabled = true;
          const original = chBtn.textContent;
          chBtn.textContent = "Generating…";
          try {
            const d = await YC.fetchChapters(id);
            if (d.pasteWithCredit) {
              try { await navigator.clipboard.writeText(d.pasteWithCredit); }
              catch { /* clipboard blocked; the text is still in d.pasteWithCredit if this ever needs a fallback UI */ }
              toast(`Copied ${d.chapters.length} chapters. Paste as a comment.`);
              chBtn.textContent = "Copy again";
              chBtn.disabled = false;
              chBtn.onclick = async () => {
                try { await navigator.clipboard.writeText(d.pasteWithCredit); toast("Copied."); }
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
          }
        };
      }
    } catch (err) {
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

  function inject() {
    if (!currentVideoId()) { const b = document.getElementById(BTN_ID); if (b) b.remove(); return; }
    if (document.getElementById(BTN_ID)) return;
    // YouTube's markup shifts; try the usual homes for the action row in order
    const host =
      document.querySelector("#top-level-buttons-computed") ||
      document.querySelector("ytd-menu-renderer #top-level-buttons") ||
      document.querySelector("#actions-inner #menu") ||
      document.querySelector("#owner");
    if (!host) return;
    host.prepend(makeButton());
  }

  // YouTube is an SPA: watch for navigation and re-inject
  function watch() {
    const id = currentVideoId();
    if (id !== lastVideoId) { lastVideoId = id; closePanel(); }
    inject();
  }
  document.addEventListener("yt-navigate-finish", () => setTimeout(watch, 400));
  new MutationObserver(() => watch()).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(watch, 1500);
  watch();
})();
