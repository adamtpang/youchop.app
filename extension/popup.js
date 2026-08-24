/* popup.js, mirrors the in-page button for people who prefer the toolbar icon.
   It just asks the content script on the active tab to open its panel. */
(async () => {
  const msg = document.getElementById("msg");
  const go = document.getElementById("go");
  // Render the failure log FIRST, and unconditionally. Its whole point is to be
  // readable after the fact, which usually means after navigating away from the
  // video that failed, so it must not sit behind the on-a-video check below.
  await (async function renderLog() {
    const box = document.getElementById("log");
    const label = document.getElementById("log-msg");
    const log = await YC.readFailures();
    if (!log.length) return; // nothing has failed; stay out of the way
    box.style.display = "block";
    const last = log[log.length - 1];
    label.textContent =
      log.length + (log.length === 1 ? " failed chop" : " failed chops") +
      " logged, latest " + (last.at || "").replace("T", " ").slice(0, 16) + " UTC";
    document.getElementById("log-copy").onclick = async function () {
      try {
        await navigator.clipboard.writeText(YC.formatFailures(log));
        label.textContent = "Copied " + log.length + " to the clipboard.";
      } catch { label.textContent = "Clipboard blocked."; }
    };
    document.getElementById("log-clear").onclick = async function () {
      await YC.clearFailures();
      box.style.display = "none";
    };
  })();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  const onVideo = /youtube\.com\/(watch\?|shorts\/)/.test(url);

  if (!onVideo) {
    msg.textContent = "Open a YouTube video, then click Chop.";
    return;
  }
  msg.textContent = "Ready. Extract this video's transcript.";
  go.disabled = false;
  go.onclick = async () => {
    go.disabled = true;
    go.textContent = "Extracting...";
    try {
      // click the injected button so the panel renders in the page context
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.getElementById("youchop-btn")?.click(),
      });
      window.close();
    } catch (e) {
      msg.textContent = "Reload the YouTube tab and try again.";
      go.disabled = false;
      go.textContent = "Chop this video";
    }
  };
})();
