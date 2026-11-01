/* Local audio transcription bridge. Runs only in the extension service worker. */
(() => {
  const base = "http://127.0.0.1:8876";
  const offline = "Start the local transcriber with npm run transcribe in the YouChop folder, then retry Deep transcribe.";
  async function request(path, options = {}) {
    let response;
    try { response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(15000) }); }
    catch { throw new Error(offline); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Local transcriber returned ${response.status}.`);
    return data;
  }
  async function start(url) {
    const session = await request("/api/session");
    if (session.protocol !== 2) throw new Error("Restart the local transcriber with npm run transcribe to enable YouTube Deep transcribe.");
    return request("/api/jobs", { method: "POST", headers: {
      "Content-Type": "application/json", "X-YouChop-Token": session.token,
    }, body: JSON.stringify({ url, model: "small" }) });
  }
  function status(message) {
    if (/^[a-f0-9]{32}$/.test(message.jobId || "")) return request("/api/jobs/" + message.jobId);
    throw new Error("Invalid transcription request.");
  }
  async function youtube(message, sender) {
    const url = new URL(sender.url || "about:blank");
    if (!sender.tab?.id || url.origin !== "https://www.youtube.com" ||
        !/^[A-Za-z0-9_-]{11}$/.test(message.videoId || "")) throw new Error("Open a YouTube video first.");
    const pageId = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
    if (pageId !== message.videoId) throw new Error("The video changed. Reopen Chop.");
    if (message.action === "start") return start(`https://www.youtube.com/watch?v=${message.videoId}`);
    if (message.action === "status") return status(message);
    throw new Error("Invalid transcription request.");
  }
  // Instagram profile batches: the page only ever names a canonical post URL;
  // the local service downloads it anonymously, so no cookies leave the browser.
  async function instagram(message, sender) {
    const url = new URL(sender.url || "about:blank");
    if (!sender.tab?.id || url.origin !== "https://www.instagram.com") throw new Error("Open an Instagram profile first.");
    if (message.action === "start") {
      const post = globalThis.YouChopInstagram?.instagramUrlFrom(message.url || "");
      if (!post) throw new Error("Invalid Instagram post.");
      return start(post);
    }
    if (message.action === "status") return status(message);
    throw new Error("Invalid transcription request.");
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    const handler = message?.type === "youchop-deep-transcribe" ? youtube
      : message?.type === "youchop-instagram-transcribe" ? instagram : null;
    if (!handler) return false;
    handler(message, sender).then(data => reply({ ok: true, data }), error => reply({ ok: false, error: error.message }));
    return true;
  });
})();
