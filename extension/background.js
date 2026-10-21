/* background.js, service worker.
 *
 * Its only job is to upgrade YouTube tabs that are already open when the
 * extension is reloaded or updated. Chrome does NOT replace a content script that
 * is already running in an open tab, so without this an old build keeps answering
 * long after the files on disk changed. That cost several rounds of debugging a
 * bug that had already been fixed, so fix the cause rather than remembering to
 * hard-refresh every time.
 *
 * lib.js can be replaced in place. Starting with content build 0.10.3,
 * content.js also exposes a cleanup hook, so an update can replace its observer,
 * interval, and listener without stacking them. Older playlist tabs are reloaded
 * once because those builds cannot be safely detached.
 */
importScripts('channel-queue.js');
importScripts('deep-transcribe.js');
chrome.runtime.onInstalled.addListener(async () => {
  const currentBuild = chrome.runtime.getManifest().version;
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
  } catch {
    return; // no host access yet; nothing to upgrade
  }
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      const [probe] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          wired: !!window.__youchopWired,
          contentBuild: window.__youchopContentBuild || "",
          hasCleanup: typeof window.__youchopContentCleanup === "function",
        }),
      });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["channel-queue.js", "lib.js"] });
      const state = probe?.result || {};
      if (!state.wired || state.contentBuild !== currentBuild) {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
      }
      if (!state.wired) {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      } else if (state.contentBuild !== currentBuild) {
        if (state.hasCleanup) {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        } else if (/youtube\.com\/(?:playlist\?|watch\?.*[?&]list=)/i.test(tab.url || "")) {
          await chrome.tabs.reload(tab.id);
        }
      }
    } catch {
      // tab may be mid-navigation or otherwise not scriptable; skip it
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'youchop-channel-page') return false;
  if (!sender.tab?.id) { sendResponse({ ok: false, error: 'Open a channel tab first.' }); return false; }
  chrome.scripting.executeScript({ target: { tabId: sender.tab.id }, world: 'MAIN',
    func: YCQueue.page, args: [message.options || {}],
  }).then(results => {
    const result = results?.[0]?.result;
    sendResponse(result && Array.isArray(result.videos) ? { ok: true, ...result } :
      { ok: false, error: result?.error || 'YouTube did not return a video list. Reload this channel and retry.' });
  })
    .catch(error => sendResponse({ ok: false, error: String(error.message || error) }));
  return true;
});

/* Content scripts run in an isolated JavaScript world, so they can read the DOM
 * but not YouTube's ytcfg object or Polymer's continuation data. Read only that
 * request bundle in MAIN and replay the panel request there. The response crosses
 * only the extension boundary and nothing is sent off the YouTube origin. */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "youchop-transcript-context") return false;
  const tabId = sender.tab?.id;
  if (!tabId) { sendResponse({ ok: false, error: "no sender tab", debug: { stage: "message" } }); return false; }

  // This timer runs in the worker, outside background-tab timer throttling.
  // A suspended page must not leave the content script awaiting MAIN for minutes.
  let replied = false;
  const respond = (result) => {
    if (replied) return;
    replied = true;
    clearTimeout(responseTimer);
    sendResponse(result);
  };
  const responseTimer = setTimeout(() => respond({
    ok: false, error: "YouTube transcript loader timed out",
    debug: { stage: "timeout", budgetMs: 12000 },
  }), 12000);

  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async () => {
      const panels = [...document.querySelectorAll("ytd-engagement-panel-section-list-renderer")]
        .filter((panel) => /transcript/i.test(panel.getAttribute("target-id") || ""));
      const panel = panels.find((item) => !/HIDDEN/i.test(item.getAttribute("visibility") || "")) || panels[0];
      const continuation = panel?.querySelector("ytd-continuation-item-renderer");
      const data = continuation?.data || continuation?.polymerController?.data;
      const endpoint = data?.continuationEndpoint;
      const ytcfgObject = globalThis.ytcfg;
      const context = ytcfgObject?.get?.("INNERTUBE_CONTEXT");
      const apiUrl = endpoint?.commandMetadata?.webCommandMetadata?.apiUrl || "/youtubei/v1/get_transcript";
      let params = endpoint?.getTranscriptEndpoint?.params || "";
      const apiKey = ytcfgObject?.get?.("INNERTUBE_API_KEY") || "";
      const clientName = ytcfgObject?.get?.("INNERTUBE_CONTEXT_CLIENT_NAME") || context?.client?.clientName || 1;
      const clientVersion = ytcfgObject?.get?.("INNERTUBE_CONTEXT_CLIENT_VERSION") || context?.client?.clientVersion || "";
      // Diagnostic metadata only. Never include the API key, continuation params,
      // request context, visitor data, cookies, response body, or transcript text.
      const debug = {
        stage: "inspect",
        panelCount: panels.length,
        panels: panels.map((item) => ({
          target: item.getAttribute("target-id") || "?",
          visibility: item.getAttribute("visibility") || "?",
          continuation: !!item.querySelector("ytd-continuation-item-renderer"),
          textChars: (item.textContent || "").trim().length,
        })),
        selectedPanel: panel?.getAttribute("target-id") || "none",
        selectedVisibility: panel?.getAttribute("visibility") || "none",
        continuationFound: !!continuation,
        dataKeys: Object.keys(data || {}).slice(0, 20),
        endpointKeys: Object.keys(endpoint || {}).slice(0, 20),
        apiUrl,
        paramsChars: params.length,
        hasApiKey: !!apiKey,
        hasContext: !!context,
        clientName: String(clientName || ""),
        clientVersion: String(clientVersion || "").slice(0, 40),
        nativeTriggerAvailable: typeof continuation?.triggerContinuation === "function",
      };
      const fail = (error) => ({ ok: false, error, debug });

      // Let YouTube execute its own continuation command first. Its current web
      // client adds private request preconditions that cannot be reconstructed
      // reliably from ytcfg alone: a hand-built POST can receive
      // FAILED_PRECONDITION while this element's native method succeeds. The
      // panel sometimes has zero size, so its intersection observer never calls
      // this method by itself even though the panel says EXPANDED.
      if (typeof continuation?.triggerContinuation === "function") {
        try {
          debug.stage = "native-trigger";
          continuation.triggerContinuation();
          debug.nativeTriggered = true;
          const started = Date.now();
          const deadline = started + 5000;
          for (let attempt = 0; attempt < 50 && Date.now() < deadline; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const rows = panel?.querySelectorAll(
              "transcript-segment-view-model, ytd-transcript-segment-renderer, " +
              "[class*='transcript-segment'], [class*='segment-renderer']"
            )?.length || 0;
            if (rows) {
              debug.stage = "native-complete";
              debug.nativeRows = rows;
              debug.nativeWaitMs = Date.now() - started;
              return { ok: true, nativeRendered: true, debug };
            }
          }
          debug.nativeRows = 0;
          debug.nativeWaitMs = Date.now() - started;
          debug.nativeResult = "timed out without rows";
          // Do not start a fallback network request after resuming a long-suspended tab.
          if (debug.nativeWaitMs >= 10000) return fail("YouTube transcript loader timed out");
        } catch (error) {
          debug.nativeError = String(error?.message || error).slice(0, 160);
        }
      }

      if (!params) return fail("transcript continuation missing");
      if (!apiKey || !context) return fail("YouTube request context missing");
      if (apiUrl !== "/youtubei/v1/get_transcript") return fail("unexpected YouTube transcript endpoint");
      try { params = decodeURIComponent(params); } catch {}

      const headers = { "Content-Type": "application/json" };
      if (clientName) headers["X-YouTube-Client-Name"] = String(clientName);
      if (clientVersion) headers["X-YouTube-Client-Version"] = String(clientVersion);
      try {
        debug.stage = "request";
        const response = await fetch(`${apiUrl}?key=${encodeURIComponent(apiKey)}&prettyPrint=false`, {
          method: "POST",
          credentials: "include",
          signal: AbortSignal.timeout(6000),
          headers,
          body: JSON.stringify({ context, params }),
        });
        debug.responseStatus = response.status;
        debug.responseOk = response.ok;
        const raw = await response.text();
        debug.responseBytes = raw.length;
        debug.responseNonWhitespace = raw.trim().length;
        if (!response.ok) return fail(`YouTube transcript HTTP ${response.status}`);
        if (!raw.trim()) return fail("YouTube transcript endpoint returned empty");
        let responseData;
        try { responseData = JSON.parse(raw); }
        catch {
          debug.stage = "parse";
          return fail("YouTube transcript endpoint returned invalid JSON");
        }
        debug.stage = "complete";
        debug.responseRootKeys = Object.keys(responseData || {}).slice(0, 20);
        // Strip proxies and custom prototypes before Chrome serializes the result
        // across the MAIN/isolated-world boundary.
        return { ok: true, data: JSON.parse(JSON.stringify(responseData)), debug };
      } catch (error) {
        debug.stage = "fetch";
        debug.fetchError = String(error?.message || error).slice(0, 160);
        return fail("YouTube transcript request failed");
      }
    },
  }).then((results) => {
    respond(results?.[0]?.result || { ok: false, error: "empty MAIN-world result", debug: { stage: "execute" } });
  }).catch((error) => {
    respond({
      ok: false,
      error: String(error?.message || error).slice(0, 160),
      debug: { stage: "execute", executeScriptError: String(error?.message || error).slice(0, 160) },
    });
  });
  return true;
});

/* A playlist is processed one video at a time in temporary inactive tabs. Each
 * tab runs the same local extractor as a visible Chop, and this worker closes
 * only the tab it created. It never navigates, closes, or edits a user's tab. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const playlistJobs = new Map();
const TRANSCRIPT_CACHE_KEY = "youchop.transcripts.v1";
const TRANSCRIPT_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

async function readBrowserTranscriptCache(videoId, lang) {
  try {
    const payload = await chrome.storage.local.get(TRANSCRIPT_CACHE_KEY);
    const records = payload?.[TRANSCRIPT_CACHE_KEY];
    const record = records?.[`${videoId}:${String(lang || "en").toLowerCase()}`];
    if (!record || record.videoId !== videoId || Date.now() - Number(record.savedAt || 0) > TRANSCRIPT_CACHE_TTL_MS) {
      return null;
    }
    const segs = Array.isArray(record.segs)
      ? record.segs.map((segment) => ({
          t: Math.max(0, Math.floor(Number(segment.t) || 0)),
          text: String(segment.text || "").replace(/\s+/g, " ").trim(),
        })).filter((segment) => segment.text)
      : [];
    if (!segs.length) return null;
    return {
      ok: true,
      segs,
      meta: {
        videoId,
        title: String(record.meta?.title || ""),
        author: String(record.meta?.author || ""),
        duration: Math.max(0, Math.floor(Number(record.meta?.duration) || 0)),
      },
      source: "browser-cache",
    };
  } catch {
    return null;
  }
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function playlistJob(jobId) {
  const id = String(jobId || "default").slice(0, 200);
  if (!playlistJobs.has(id)) playlistJobs.set(id, { cancelled: false, tabIds: new Set() });
  return { id, state: playlistJobs.get(id) };
}

async function closeTemporaryTab(tabId) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await chrome.tabs.remove(tabId);
      return;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error);
      if (/No tab with id|tab not found/i.test(message)) return;
      await wait(100 * (attempt + 1));
    }
  }
  console.warn("YouChop could not close temporary playlist tab", tabId, lastError);
}

async function closePlaylistJob(jobId) {
  const job = playlistJobs.get(jobId);
  if (!job) return;
  job.cancelled = true;
  await Promise.all([...job.tabIds].map((tabId) => closeTemporaryTab(tabId)));
  job.tabIds.clear();
}

async function extractVideoInTemporaryTab(videoId, lang, jobId) {
  let tab = null;
  const job = playlistJob(jobId);
  try {
    if (job.state.cancelled) throw new Error("playlist chop cancelled");
    const cached = await readBrowserTranscriptCache(videoId, lang);
    if (cached) return cached;
    tab = await chrome.tabs.create({
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&autoplay=0`,
      active: false,
    });
    if (!tab?.id) throw new Error("could not create a temporary YouTube tab");
    job.state.tabIds.add(tab.id);
    try { await chrome.tabs.update(tab.id, { muted: true }); } catch {}

    for (let attempt = 0; attempt < 100; attempt++) {
      if (job.state.cancelled) throw new Error("playlist chop cancelled");
      try {
        const result = await withTimeout(
          chrome.tabs.sendMessage(tab.id, {
            type: "youchop-extract-current",
            videoId,
            lang,
          }),
          90_000,
          "local transcript extraction timed out"
        );
        if (!result?.ok) throw new Error(result?.error || "local transcript extraction failed");
        return result;
      } catch (error) {
        const message = String(error?.message || error);
        const contentScriptNotReady =
          /Receiving end does not exist|Could not establish connection|message port closed/i.test(message);
        if (!contentScriptNotReady || attempt === 99) throw error;
        await wait(250);
      }
    }
    throw new Error("YouChop did not load in the temporary tab");
  } finally {
    if (tab?.id) {
      await closeTemporaryTab(tab.id);
      job.state.tabIds.delete(tab.id);
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "youchop-extract-video") return false;
  const videoId = String(message.videoId || "");
  if (!/^[\w-]{11}$/.test(videoId)) {
    sendResponse({ ok: false, error: "invalid playlist video id" });
    return false;
  }
  extractVideoInTemporaryTab(
    videoId,
    String(message.lang || "en").slice(0, 16),
    String(message.jobId || "default").slice(0, 200)
  )
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({
      ok: false,
      error: String(error?.message || error).slice(0, 16_000),
    }));
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "youchop-cancel-playlist" && message?.type !== "youchop-finish-playlist") {
    return false;
  }
  const jobId = String(message.jobId || "default").slice(0, 200);
  closePlaylistJob(jobId)
    .then(() => {
      playlistJobs.delete(jobId);
      sendResponse({ ok: true });
    })
    .catch((error) => sendResponse({
      ok: false,
      error: String(error?.message || error).slice(0, 1000),
    }));
  return true;
});
