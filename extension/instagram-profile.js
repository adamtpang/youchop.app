/* Chop profile: on an Instagram profile, scroll the signed-in grid to collect
   post links, then transcribe each post one at a time through the local
   transcriber (npm run transcribe). It only reads links from the page: no
   likes, follows, messages or cookies. Audio is fetched anonymously by the
   local service, so each post must be public. */
(() => {
  if (window.__youchopIgProfile) return;
  window.__youchopIgProfile = true;
  const IG = globalThis.YouChopInstagram;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const send = message => chrome.runtime.sendMessage({ type: "youchop-instagram-transcribe", ...message });

  const host = document.createElement("div");
  host.id = "youchop-ig-host";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .launch { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; background: #ff4930; color: #fff;
    border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.25); }
  .panel { position: fixed; right: 20px; bottom: 20px; z-index: 2147483001; width: min(380px, calc(100vw - 32px));
    max-height: calc(100vh - 40px); overflow: auto; background: #16161c; color: #f2efe9; border-radius: 14px;
    padding: 16px; box-shadow: 0 8px 32px rgba(0,0,0,.4); display: none; }
  .row { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
  h2 { margin: 0; font-size: 15px; font-weight: 700; flex: 1; }
  p { margin: 8px 0 0; color: #b9b6c0; }
  .muted { color: #8f8d96; font-size: 12px; }
  input { width: 72px; background: #2a2a33; color: #f2efe9; border: 1px solid #3a3a44; border-radius: 8px; padding: 6px 8px; }
  button.b { flex: 1; background: #ff4930; color: #fff; border: 0; border-radius: 9px; padding: 10px; font-weight: 600; cursor: pointer; }
  button.b.ghost { background: #2a2a33; color: #f2efe9; }
  button.b:disabled { opacity: .5; cursor: default; }
  button.x { background: none; border: 0; color: #8f8d96; font-size: 18px; cursor: pointer; padding: 0 4px; }
  button:focus-visible, input:focus-visible { outline: 2px solid #ffb43a; outline-offset: 2px; }
  ol { margin: 8px 0 0; padding-left: 20px; max-height: 160px; overflow: auto; color: #b9b6c0; font-size: 12px; }
</style>
<button class="launch" id="launch" type="button">Chop profile</button>
<div class="panel" id="panel" role="dialog" aria-label="Chop Instagram profile">
  <div class="row" style="margin-top:0"><h2 id="title">Chop profile</h2><button class="x" id="close" type="button" aria-label="Close">&times;</button></div>
  <p id="status">Scroll this profile to find its posts, then transcribe them locally with Whisper.</p>
  <div class="row"><label class="muted" for="limit">Up to</label><input id="limit" type="number" min="1" max="300" value="100"><span class="muted">posts</span></div>
  <div class="row"><button class="b" id="find" type="button">Find posts</button><button class="b ghost" id="stop" type="button" style="display:none">Stop</button></div>
  <ol id="list"></ol>
  <div class="row"><button class="b" id="run" type="button" style="display:none">Transcribe</button></div>
  <div class="row"><button class="b" id="download" type="button" style="display:none">Download Markdown</button><button class="b ghost" id="copy" type="button" style="display:none">Copy</button></div>
  <p class="muted">Needs the local transcriber: run npm run transcribe in the YouChop folder. Only public posts can be downloaded. Machine transcripts are unverified.</p>
</div>`;
  const $ = id => root.getElementById(id);
  let profile = null, posts = [], items = [], busy = false, stopped = false, markdown = "";

  const setStatus = text => { $("status").textContent = text; };
  function show(id, on) { $(id).style.display = on ? "" : "none"; }
  function renderList() {
    $("list").replaceChildren(...posts.map((p, n) => {
      const li = document.createElement("li");
      const item = items[n];
      li.textContent = p.code + (item ? ` (${item.status === "done" ? item.result.words + " words" : item.status === "no-speech" ? "no speech" : item.status})` : "");
      return li;
    }));
  }
  function open() {
    profile = IG.profileFrom(location.href) || profile;
    if (!profile) return;
    $("title").textContent = "@" + profile.username;
    $("panel").style.display = "block";
    show("launch", false);
    $("find").focus();
  }
  window.__youchopIgOpen = open;

  // Scroll the visible tab until it stops growing. The grid renders late after
  // a tab switch, so an empty page gets a longer grace period than a stalled one.
  async function scrollTab(found, limit, tabName) {
    let idle = 0, last = -1, rounds = 0;
    const start = found.size;
    while (!stopped && found.size < limit) {
      const hrefs = [...document.querySelectorAll("main a[href]")].map(a => a.getAttribute("href"));
      for (const post of IG.postsFromHrefs(hrefs)) if (found.size < limit && !found.has(post.code)) found.set(post.code, post);
      posts = [...found.values()];
      setStatus(`${tabName}: found ${posts.length} posts so far. Scrolling...`);
      renderList();
      idle = found.size > last ? 0 : idle + 1;
      last = found.size;
      if (idle >= (found.size > start || rounds > 10 ? 4 : 10)) break;
      rounds++;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1500);
    }
  }

  async function findPosts() {
    const limit = Math.min(300, Math.max(1, parseInt($("limit").value, 10) || 100));
    busy = true; stopped = false;
    show("stop", true); $("find").disabled = true; show("run", false);
    const found = new Map();
    // Reels can be posted to the Reels tab only, and photos appear only on the
    // grid, so scan both tabs with Instagram's own in-page links (no reload).
    const onReels = /\/reels\/?$/.test(location.pathname);
    await scrollTab(found, limit, onReels ? "Reels tab" : "Posts grid");
    const other = document.querySelector(`main a[href="/${profile.username}/${onReels ? "" : "reels/"}"]`);
    if (!stopped && found.size < limit && other) {
      window.scrollTo(0, 0);
      other.click();
      await sleep(1500);
      await scrollTab(found, limit, onReels ? "Posts grid" : "Reels tab");
    }
    window.scrollTo(0, 0);
    busy = false; show("stop", false); $("find").disabled = false;
    items = [];
    setStatus(posts.length ? `Found ${posts.length} posts. If you expected more, sign in to Instagram and find again.` : "No posts found. Sign in to Instagram, open the profile grid, and try again.");
    if (posts.length) { show("run", true); $("run").textContent = `Transcribe ${posts.length}`; }
  }

  async function transcribe() {
    busy = true; stopped = false; items = [];
    show("stop", true); show("run", false); $("find").disabled = true;
    show("download", false); show("copy", false);
    for (let n = 0; n < posts.length && !stopped; n++) {
      const post = posts[n];
      const label = `${n + 1} of ${posts.length}`;
      setStatus(`${label}: starting...`);
      const started = await send({ action: "start", url: post.url }).catch(e => ({ ok: false, error: e.message }));
      if (!started?.ok) {
        // The service being offline stops the batch; per-post errors do not.
        if (/npm run transcribe|Restart/.test(started?.error || "")) { setStatus(started.error); break; }
        items[n] = { ...post, status: "error", error: started?.error };
        renderList();
        continue;
      }
      let job = { status: "queued" };
      while (!stopped && ["queued", "running"].includes(job.status)) {
        await sleep(2500);
        const polled = await send({ action: "status", jobId: started.data.id }).catch(e => ({ ok: false, error: e.message }));
        if (!polled?.ok) { job = { status: "error", message: polled?.error }; break; }
        job = polled.data;
        setStatus(`${label}: ${job.message || job.status}`);
      }
      if (job.status === "done") items[n] = { ...post, status: job.result?.segments?.length ? "done" : "no-speech", result: job.result };
      else if (job.status === "error") items[n] = { ...post, status: "error", error: String(job.message || "failed").slice(0, 160) };
      renderList();
      if (n < posts.length - 1) await sleep(3000); // be gentle with Instagram between downloads
    }
    const finished = items.filter(Boolean);
    const done = finished.filter(i => i.status === "done");
    busy = false; show("stop", false); $("find").disabled = false; show("run", true);
    $("run").textContent = `Transcribe ${posts.length} again`;
    if (!finished.length) return;
    markdown = IG.profileMarkdown(profile, finished, new Date().toISOString());
    const words = done.reduce((s, i) => s + i.result.words, 0);
    setStatus(`${stopped ? "Stopped. " : ""}${done.length} of ${finished.length} transcribed, ${words.toLocaleString("en-US")} words. Already finished posts are reused if you run again while the local transcriber stays open.`);
    show("download", true); show("copy", true);
  }

  $("launch").onclick = open;
  $("close").onclick = () => { if (busy) stopped = true; $("panel").style.display = "none"; show("launch", !!IG.profileFrom(location.href)); };
  $("stop").onclick = () => { stopped = true; setStatus("Stopping after the current post..."); };
  $("find").onclick = findPosts;
  $("run").onclick = transcribe;
  $("download").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    a.download = `${profile.username}-instagram-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("copy").onclick = async () => {
    try { await navigator.clipboard.writeText(markdown); setStatus("Copied."); } catch { setStatus("Clipboard blocked. Use Download."); }
  };

  // Instagram is a single-page app: show the launcher only on profile routes,
  // and reset the post list when a different profile opens.
  let lastProfile = "";
  function sync() {
    if (!document.body.contains(host)) document.body.appendChild(host);
    const current = IG.profileFrom(location.href);
    if (current && current.username !== lastProfile && !busy) {
      posts = []; items = []; renderList(); show("run", false); show("download", false); show("copy", false);
      setStatus("Scroll this profile to find its posts, then transcribe them locally with Whisper.");
    }
    lastProfile = current?.username || lastProfile;
    const panelOpen = $("panel").style.display === "block";
    show("launch", !!current && !panelOpen);
  }
  sync();
  setInterval(sync, 1000);
})();
