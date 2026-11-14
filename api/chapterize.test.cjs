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
    assert.match(result.body.pasteWithCredit, /https:\/\/youchop\.vercel\.app$/);
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

test("heuristic chapter count scales with video length and reaches the end", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, text: async () => "<html></html>" });
  try {
    const run = async (minutes) => {
      // one caption line every 8 seconds, like real auto-captions
      const segments = Array.from({ length: Math.floor(minutes * 60 / 8) }, (_, index) => ({
        t: index * 8,
        text: `Topic ${index + 1} with a distinct practical lesson`,
      }));
      const result = await invoke({
        id: "abcdefghijk",
        engine: "heuristic",
        meta: { title: "Long video", duration: minutes * 60 },
        segments,
      });
      assert.equal(result.status, 200);
      return { result, segments };
    };
    const { result, segments } = await run(100);
    const count = result.body.chapters.length;
    assert.ok(count >= 15 && count <= 22, `100 minutes gave ${count} chapters`);
    assert.ok(segments.at(-1).t - result.body.chapters.at(-1).start < 600, "last chapter is near the end");
    const short = (await run(10)).result.body.chapters.length;
    assert.ok(short >= 4 && short <= 7, `10 minutes gave ${short} chapters`);
    const long = (await run(240)).result.body.chapters.length;
    assert.ok(long >= 24 && long <= 34, `240 minutes gave ${long} chapters`);
    assert.match(result.body.pasteWithCredit, /\n\n⏱ Chapters by https:\/\/youchop\.vercel\.app$/);
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

test("AI rejection returns a labeled basic draft with readable caption entities", async () => {
  const previousFetch = global.fetch;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  global.fetch = async (url) => String(url).startsWith("https://api.anthropic.com/")
    ? { ok: false, status: 401, json: async () => ({ error: { message: "invalid key" } }) }
    : { ok: true, status: 200, text: async () => "<html></html>" };
  try {
    const result = await invoke({ id: "abcdefghijk", segments: [
      { t: 0, text: "I&#39;m explaining the opening idea" },
      { t: 60, text: "A second practical lesson" },
    ] });
    assert.equal(result.status, 200);
    assert.equal(result.body.engine, "heuristic");
    assert.equal(result.body.anthropicFallback, "anthropic_error");
    assert.match(result.body.warning, /Basic chapter draft/);
    assert.match(result.body.paste, /I'm explaining/);
    assert.doesNotMatch(result.body.paste, /&#39;/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});
