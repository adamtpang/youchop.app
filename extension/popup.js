/* popup.js, mirrors the in-page button for people who prefer the toolbar icon.
   It just asks the content script on the active tab to open its panel. */
(async () => {
  const msg = document.getElementById("msg");
  const go = document.getElementById("go");
  const goPlaylist = document.getElementById("go-playlist");
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
  const instagram = YouChopInstagram.localToolUrl(url);
  if (instagram) {
    msg.textContent = "Instagram transcription runs in the free local tool. Start it with npm run transcribe in the YouChop folder.";
    document.querySelector('.note').textContent = "The local tool gets this video's audio and transcribes it on your computer. You can also choose a local media file.";
    go.disabled = false;
    go.textContent = "Open Instagram transcriber";
    go.onclick = async () => { await chrome.tabs.create({ url: instagram }); window.close(); };
    return;
  }
  const onVideo = /youtube\.com\/(watch\?|shorts\/)/.test(url);
  const playlistId = YC.playlistIdFrom(url);
  const channelRef = YC.channelRefFrom(url);

  if (!onVideo && !playlistId && !channelRef) {
    msg.textContent = "Open a YouTube video, playlist, channel, or Instagram video post, then click Chop.";
    return;
  }
  msg.textContent = channelRef ? "Choose this channel’s video order, filters, and queue size." : playlistId
    ? "Ready. Chop this video or its whole playlist."
    : "Ready. Extract this video's transcript.";

  async function clickInjected(buttonId, button, workingLabel) {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = workingLabel;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (id) => {
          const target = document.getElementById(id);
          if (!target) return false;
          target.click();
          return true;
        },
        args: [buttonId],
      });
      if (!result) throw new Error("in-page button not ready");
      window.close();
    } catch {
      msg.textContent = "Reload the YouTube tab and try again.";
      button.disabled = false;
      button.textContent = original;
    }
  }

  if (channelRef) {
    go.disabled = false;
    go.textContent = 'Build channel queue';
    go.onclick = () => clickInjected('youchop-btn', go, 'Opening queue...');
  } else if (onVideo) {
    go.disabled = false;
    go.onclick = () => clickInjected("youchop-btn", go, "Extracting...");
  } else {
    go.style.display = "none";
  }

  if (playlistId) {
    goPlaylist.style.display = "block";
    goPlaylist.disabled = false;
    goPlaylist.onclick = () => clickInjected("youchop-playlist-btn", goPlaylist, "Starting playlist...");
  }
})();
