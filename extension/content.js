/* content.js — injects the one-click Chop button into YouTube's own action row
   and renders the result in a panel. All work happens locally in this tab. */
(function () {
  "use strict";
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
        <span class="yc-meta" id="yc-meta"></span>
        <button class="yc-x" id="yc-close" title="Close">&times;</button>
      </div>
      <div class="yc-bar">
        <div class="yc-seg" id="yc-fmt">
          <button data-f="clean" class="on">Clean text</button>
          <button data-f="timestamps">Timestamps</button>
          <button data-f="markdown">Markdown</button>
        </div>
        <div class="yc-actions">
          <button class="yc-btn ghost" id="yc-download">Download</button>
          <button class="yc-btn red" id="yc-copy">Copy</button>
        </div>
      </div>
      <textarea class="yc-out" id="yc-out" readonly></textarea>
      <div class="yc-foot" id="yc-foot"></div>`;
    document.body.appendChild(el);
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
    out.value = "Reading captions from this video...";
    let state = { segs: null, meta: null, format: "clean" };

    try {
      const res = await YC.extract(id, "clean");
      state.segs = res.segs; state.meta = res.meta;
      const words = res.text.trim().split(/\s+/).length;
      $("#yc-meta", el).textContent =
        `${res.meta.title.slice(0, 54)} · ${words.toLocaleString()} words · ~${Math.round(res.text.length / 4).toLocaleString()} tokens · ${res.language}`;
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
    } catch (err) {
      out.value = "";
      $("#yc-foot", el).textContent = String(err.message || err);
      $("#yc-meta", el).textContent = "could not extract";
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
