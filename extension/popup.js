/* popup.js, mirrors the in-page button for people who prefer the toolbar icon.
   It just asks the content script on the active tab to open its panel. */
(async () => {
  const msg = document.getElementById("msg");
  const go = document.getElementById("go");
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
