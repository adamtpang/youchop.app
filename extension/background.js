/* background.js, service worker.
 *
 * Its only job is to upgrade YouTube tabs that are already open when the
 * extension is reloaded or updated. Chrome does NOT replace a content script that
 * is already running in an open tab, so without this an old build keeps answering
 * long after the files on disk changed. That cost several rounds of debugging a
 * bug that had already been fixed, so fix the cause rather than remembering to
 * hard-refresh every time.
 *
 * Re-running lib.js is enough on its own: it declares `var YC`, so the object is
 * replaced, and the already-running content script calls into the new one because
 * it resolves YC globally at call time rather than capturing it. content.js is
 * only injected when the tab has never had it, since re-running it would stack up
 * a second MutationObserver and interval.
 */
chrome.runtime.onInstalled.addListener(async () => {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
  } catch {
    return; // no host access yet; nothing to upgrade
  }
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["lib.js"] });
      const [probe] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => !!window.__youchopWired,
      });
      if (!probe?.result) {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      }
    } catch {
      // tab may be mid-navigation or otherwise not scriptable; skip it
    }
  }
});
