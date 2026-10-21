const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("./chapterize.js");

function invoke(body) {
  return new Promise((resolve, reject) => {
    const req = { method: "POST", body, query: {} };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, body: value }); return this; },
      end() { resolve({ status: this.statusCode, body: null }); return this; },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

test("chapterize skips transcript providers when browser rows are supplied", async () => {
  const previousFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, status: 200, text: async () => "<html></html>" };
  };

  try {
    const result = await invoke({
      id: "abcdefghijk",
      engine: "heuristic",
      meta: { title: "Local transcript", author: "YouChop test" },
      segments: [
        { t: 0, text: "Opening and the main question" },
        { t: 50, text: "First practical example" },
        { t: 100, text: "Second practical example" },
        { t: 150, text: "Important tradeoffs and limitations" },
        { t: 205, text: "The final recommendation" },
      ],
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.transcriptProvider, "browser-local");
    assert.equal(result.body.engine, "heuristic");
    assert.ok(result.body.chapters.length >= 2);
    assert.match(result.body.paste, /^0:00 /);
    assert.match(result.body.pasteWithCredit, /https:\/\/youchop\.app$/);
    assert.deepEqual(urls, ["https://www.youtube.com/watch?v=abcdefghijk"]);
  } finally {
    global.fetch = previousFetch;
  }
});

test("chapterize refuses a video that already has YouTube chapters", async () => {
  const previousFetch = global.fetch;
  let fetches = 0;
  global.fetch = async () => {
    fetches++;
    return {
      ok: true,
      status: 200,
      text: async () => '<div id="engagement-panel-macro-markers-description-chapters"></div>',
    };
  };
  try {
    const result = await invoke({
      id: "abcdefghijk",
      engine: "heuristic",
      segments: [{ t: 0, text: "Opening" }, { t: 60, text: "Next topic" }],
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.error, "already_chapterized");
    assert.equal(fetches, 1);
  } finally {
    global.fetch = previousFetch;
  }
});

test("chapterize recognises creator timestamps in the video description", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => '{"shortDescription":"0:00 Opening\\n1:15 First topic\\n3:40 Final topic"}',
  });
  try {
    const result = await invoke({
      id: "abcdefghijk",
      engine: "heuristic",
      segments: [{ t: 0, text: "Opening" }, { t: 75, text: "First topic" }],
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.error, "already_chapterized");
  } finally {
    global.fetch = previousFetch;
  }
});

test("heuristic chapter generation has no 20-chapter ceiling and reaches the end", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, text: async () => "<html></html>" });
  try {
    const segments = Array.from({ length: 26 }, (_, index) => ({
      t: index * 151,
      text: `Topic ${index + 1} with a distinct practical lesson`,
    }));
    const result = await invoke({
      id: "abcdefghijk",
      engine: "heuristic",
      meta: { title: "Long video", duration: 3900 },
      segments,
    });
    assert.equal(result.status, 200);
    assert.ok(result.body.chapters.length > 20);
    assert.equal(result.body.chapters.at(-1).start, segments.at(-1).t);
    assert.match(result.body.pasteWithCredit, /\n\n⏱ Chapters by https:\/\/youchop\.app$/);
  } finally {
    global.fetch = previousFetch;
  }
});

test("chapterize refuses a local transcript that ends far before the video", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, text: async () => "<html></html>" });
  try {
    const result = await invoke({
      id: "abcdefghijk",
      engine: "heuristic",
      meta: { title: "Incomplete video", duration: 1800 },
      segments: [{ t: 0, text: "Opening" }, { t: 300, text: "Transcript stops here" }],
    });
    assert.equal(result.status, 422);
    assert.equal(result.body.error, "incomplete_transcript");
    assert.equal(result.body.transcriptEnd, 300);
    assert.equal(result.body.duration, 1800);
  } finally {
    global.fetch = previousFetch;
  }
});

test("chapterize rejects an explicitly empty local transcript", async () => {
  const previousFetch = global.fetch;
  let fetches = 0;
  global.fetch = async () => { fetches++; throw new Error("should not fetch"); };
  try {
    const result = await invoke({ id: "abcdefghijk", segments: [] });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, "invalid_segments");
    assert.equal(fetches, 0);
  } finally {
    global.fetch = previousFetch;
  }
});
