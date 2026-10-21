const test = require("node:test");
const assert = require("node:assert/strict");
const YC = require("./lib.js");
const manifest = require("./manifest.json");

test("a failed priming request is not sent again by the extraction fallback", async () => {
  const previousChrome = global.chrome;
  const previousPanel = YC.expandedTranscriptPanel;
  let requests = 0;
  global.chrome = { runtime: { sendMessage: async () => {
    requests++;
    return { ok: false, error: "YouTube transcript HTTP 400" };
  } } };
  YC.expandedTranscriptPanel = () => ({
    querySelector: () => ({}), getAttribute: () => "transcript",
  });
  YC.lastEndpointError = null;
  try {
    assert.equal(await YC.primeTranscriptContinuation(), false);
    await assert.rejects(() => YC.fetchTranscriptContinuation(), /HTTP 400/);
    assert.equal(requests, 1);
  } finally {
    YC.lastEndpointError = null;
    YC.expandedTranscriptPanel = previousPanel;
    global.chrome = previousChrome;
  }
});

test("Transcript selection uses the nested button and respects its selected state", async () => {
  const previousPanel = YC.visibleTranscriptPanel;
  const previousSleep = YC.sleep;
  let selected = false, clicks = 0;
  const button = {
    tagName: "BUTTON", textContent: "Transcript",
    getAttribute: () => String(selected),
    click: () => { clicks++; selected = true; },
  };
  const wrapper = {
    tagName: "CHIP-VIEW-MODEL", textContent: "Transcript", getAttribute: () => null,
    click: () => { throw new Error("wrapper is not the actionable control"); },
  };
  YC.visibleTranscriptPanel = () => ({
    querySelectorAll: () => [wrapper, button], getAttribute: () => "transcript",
  });
  YC.sleep = async () => {};
  try {
    assert.equal(await YC.selectTranscriptChip(), true);
    assert.equal(await YC.selectTranscriptChip(), true);
    assert.equal(clicks, 1);
  } finally {
    YC.visibleTranscriptPanel = previousPanel;
    YC.sleep = previousSleep;
  }
});

test("library build matches the extension manifest version", () => {
  assert.equal(YC.BUILD, manifest.version);
});

test("successful browser transcripts persist and bypass extraction on the next chop", async () => {
  const previousChrome = global.chrome;
  const previousDocument = global.document;
  const previousLocation = global.location;
  const previousOpenPanel = YC.openPanel;
  const values = {};
  global.chrome = {
    runtime: { getManifest: () => ({ version: manifest.version }) },
    storage: {
      local: {
        async get(key) { return { [key]: values[key] }; },
        async set(payload) { Object.assign(values, payload); },
      },
    },
  };
  global.document = { title: "Cached lesson - YouTube", querySelector: () => null };
  global.location = { href: "https://www.youtube.com/watch?v=abcdefghijk" };

  try {
    assert.equal(await YC.saveTranscriptCache(
      "abcdefghijk",
      "en",
      [{ t: 0, text: "Saved opening" }, { t: 65, text: "Saved second idea" }],
      { videoId: "abcdefghijk", title: "Cached lesson", author: "Teacher", duration: 120 },
      "panel",
    ), true);
    YC.openPanel = async () => { throw new Error("extraction should not run on a cache hit"); };

    const result = await YC.extract("abcdefghijk", "markdown", "en");
    assert.equal(result.source, "browser-cache");
    assert.equal(result.segs.length, 2);
    assert.equal(result.meta.title, "Cached lesson");
    assert.match(result.text, /Saved second idea/);
    assert.match(YC.formatTrace(), /path\.browser_cache\.success/);
  } finally {
    YC.openPanel = previousOpenPanel;
    global.chrome = previousChrome;
    global.document = previousDocument;
    global.location = previousLocation;
  }
});

const rendererResponse = {
  actions: [{
    updateEngagementPanelAction: {
      content: {
        transcriptRenderer: {
          body: {
            transcriptSegmentListRenderer: {
              initialSegments: [
                { transcriptSegmentRenderer: {
                  startMs: "9000",
                  snippet: { simpleText: "Second line" },
                } },
                { transcriptSegmentRenderer: {
                  startMs: "4200",
                  snippet: { runs: [{ text: "Hello " }, { text: "world" }] },
                } },
              ],
            },
          },
        },
      },
    },
  }],
};

test("parses and sorts transcriptSegmentRenderer rows", () => {
  assert.deepEqual(YC.parseTranscriptResponse(rendererResponse), [
    { t: 4, text: "Hello world" },
    { t: 9, text: "Second line" },
  ]);
});

test("parses transcriptSegmentViewModel timestamp text", () => {
  const response = {
    frameworkUpdates: {
      entityBatchUpdate: {
        mutations: [{
          payload: {
            transcriptSegmentViewModel: {
              startTimeText: { content: "1:02" },
              snippet: { content: "New view-model shape" },
            },
          },
        }],
      },
    },
  };
  assert.deepEqual(YC.parseTranscriptResponse(response), [
    { t: 62, text: "New view-model shape" },
  ]);
});

test("uses the MAIN-world continuation response for a free local request", async () => {
  const previousChrome = global.chrome;
  let message;
  YC.resetTrace({ test: "MAIN-world continuation" });
  global.chrome = {
    runtime: {
      sendMessage: async (value) => {
        message = value;
        return {
          ok: true,
          data: rendererResponse,
          debug: { stage: "complete", responseStatus: 200, responseBytes: 1234 },
        };
      },
    },
  };

  try {
    const rows = await YC.fetchTranscriptContinuation();
    assert.equal(rows.length, 2);
    assert.deepEqual(message, { type: "youchop-transcript-context" });
    assert.match(YC.formatTrace(), /youtube\.main_world\.response/);
    assert.match(YC.formatTrace(), /"responseStatus":200/);
    assert.match(YC.formatTrace(), /youtube\.transcript\.success.*"rows":2/);
  } finally {
    global.chrome = previousChrome;
  }
});

test("reads DOM rows after YouTube's native continuation renders them", async () => {
  const previousChrome = global.chrome;
  const previousFromPanel = YC.fromPanel;
  YC.lastEndpointResult = null;
  YC.fromPanel = () => [{ t: 3, text: "Rendered by YouTube" }];
  global.chrome = {
    runtime: {
      sendMessage: async () => ({
        ok: true,
        nativeRendered: true,
        debug: { stage: "native-complete", nativeRows: 1 },
      }),
    },
  };

  try {
    assert.deepEqual(await YC.fetchTranscriptContinuation(), [
      { t: 3, text: "Rendered by YouTube" },
    ]);
    assert.match(YC.formatTrace(), /"nativeRendered":true/);
  } finally {
    YC.fromPanel = previousFromPanel;
    global.chrome = previousChrome;
  }
});

test("reports an empty caption response without a JSON parser exception", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, text: async () => "" });
  try {
    await assert.rejects(
      () => YC.fetchTrack({ baseUrl: "https://www.youtube.com/api/timedtext?x=1" }),
      /caption endpoint returned an empty response/,
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test("recognises playlist and watch-with-playlist URLs", () => {
  const id = "PL1234567890abcdef";
  assert.equal(YC.playlistIdFrom(`https://www.youtube.com/playlist?list=${id}`), id);
  assert.equal(YC.playlistIdFrom(`https://www.youtube.com/watch?v=abcdefghijk&list=${id}&index=2`), id);
  assert.equal(YC.playlistIdFrom("https://www.youtube.com/watch?v=abcdefghijk"), null);
  assert.equal(YC.playlistUrlFrom(`https://www.youtube.com/watch?v=abcdefghijk&list=${id}`),
    `https://www.youtube.com/playlist?list=${id}`);
});

test("recognises a valid YouTube chapter sequence in description text", () => {
  assert.equal(YC.textHasChapterSequence("0:00 Opening\n1:05 First topic\n4:20 Final topic"), true);
  assert.equal(YC.textHasChapterSequence("0:05 Opening\n1:05 First topic\n4:20 Final topic"), false);
  assert.equal(YC.textHasChapterSequence("0:00 Opening\n0:05 Too close\n4:20 Final topic"), false);
  assert.equal(YC.textHasChapterSequence("0:00 One timestamp\n1:05 Only two"), false);
});

test("renders a durable Markdown playlist corpus with source links and failures", () => {
  const text = YC.renderPlaylist([
    {
      meta: { videoId: "abcdefghijk", title: "First lesson" },
      segs: [{ t: 0, text: "Opening idea" }, { t: 65, text: "Second idea" }],
    },
  ], { id: "PL1234567890abcdef", title: "Guide series" }, "markdown", [
    { videoId: "lmnopqrstuv", title: "Private lesson", error: "unavailable" },
  ]);

  assert.match(text, /^# Guide series/m);
  assert.match(text, /youtube\.com\/playlist\?list=PL1234567890abcdef/);
  assert.match(text, /## 1\. First lesson/);
  assert.match(text, /\[1:05\]\(https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk&t=65s\)/);
  assert.match(text, /Private lesson: unavailable/);
});

test("renders every playlist transcript as its own standalone Markdown document", () => {
  const documents = YC.playlistDocuments([
    {
      meta: { videoId: "abcdefghijk", title: "First lesson", author: "Teacher" },
      segs: [{ t: 0, text: "Opening idea" }, { t: 65, text: "Second idea" }],
    },
    {
      meta: { videoId: "lmnopqrstuv", title: "Second lesson", author: "Teacher" },
      segs: [{ t: 0, text: "A separate transcript" }],
    },
  ], { id: "PL1234567890abcdef", title: "Guide series" }, "markdown");

  assert.equal(documents.length, 2);
  assert.equal(documents[0].filename, "01 First lesson.md");
  assert.equal(documents[1].filename, "02 Second lesson.md");
  assert.match(documents[0].text, /^---\ntitle: "First lesson"/);
  assert.match(documents[0].text, /playlist_title: "Guide series"/);
  assert.match(documents[0].text, /playlist_position: 1/);
  assert.match(documents[0].text, /youtube\.com\/watch\?v=abcdefghijk&t=65s/);
  assert.doesNotMatch(documents[0].text, /Second lesson|A separate transcript/);
  assert.match(documents[1].text, /A separate transcript/);
});

test("chapter generation reuses local transcript rows", async () => {
  const previousFetch = global.fetch;
  let request;
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ chapters: [{ start: 0 }], pasteWithCredit: "0:00 Start" }),
    };
  };
  try {
    await YC.fetchChapters("abcdefghijk", [{ t: 12, text: "  Hello   world  " }], {
      title: "A title",
      author: "A channel",
      duration: 90,
    });
    assert.deepEqual(request, {
      id: "abcdefghijk",
      segments: [{ start: 12, text: "Hello world" }],
      meta: { title: "A title", author: "A channel", duration: 90 },
    });
  } finally {
    global.fetch = previousFetch;
  }
});

test("playlist extraction asks the worker for a local temporary-tab chop", async () => {
  const previousChrome = global.chrome;
  let message;
  global.chrome = {
    runtime: {
      sendMessage: async (value) => {
        message = value;
        return { ok: true, segs: [{ t: 0, text: "Ready" }], meta: {} };
      },
    },
  };
  try {
    const result = await YC.extractPlaylistVideo("abcdefghijk", "en", "job-123");
    assert.equal(result.ok, true);
    assert.deepEqual(message, {
      type: "youchop-extract-video",
      videoId: "abcdefghijk",
      lang: "en",
      jobId: "job-123",
    });
  } finally {
    global.chrome = previousChrome;
  }
});

test("lists a private playlist from the signed-in page before calling the public API", async () => {
  const previousDocument = global.document;
  const previousFetch = global.fetch;
  let fetches = 0;
  const makeRow = (videoId, title, duration) => ({
    querySelector(selector) {
      if (selector === "a#video-title") {
        return {
          href: `https://www.youtube.com/watch?v=${videoId}&list=PLN0KY-6tdXjA`,
          textContent: title,
          getAttribute(name) { return name === "title" ? title : null; },
        };
      }
      if (selector.includes("thumbnail-overlay")) return { textContent: duration };
      return null;
    },
  });
  global.document = {
    title: "Private guides - YouTube",
    querySelectorAll(selector) {
      return selector.includes("ytd-playlist-video-renderer")
        ? [
            makeRow("abcdefghijk", "First private lesson", "18:40"),
            makeRow("lmnopqrstuv", "Second private lesson", "1:02:03"),
          ]
        : [];
    },
    querySelector(selector) {
      return selector.includes("h1") ? { textContent: "Private guides" } : null;
    },
  };
  global.fetch = async () => { fetches++; throw new Error("public API should not be called"); };

  try {
    const listing = await YC.fetchPlaylistVideos("PLN0KY-6tdXjA");
    assert.equal(listing.via, "browser-local");
    assert.equal(listing.playlist.title, "Private guides");
    assert.deepEqual(listing.videos, [
      { videoId: "abcdefghijk", title: "First private lesson", seconds: 1120, published: null },
      { videoId: "lmnopqrstuv", title: "Second private lesson", seconds: 3723, published: null },
    ]);
    assert.equal(fetches, 0);
  } finally {
    global.document = previousDocument;
    global.fetch = previousFetch;
  }
});
