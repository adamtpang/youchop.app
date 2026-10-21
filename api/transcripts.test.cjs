const test = require("node:test");
const assert = require("node:assert/strict");

const transcriptCache = require("./transcript-cache");
const { fetchTranscripts } = require("./transcripts");

function memoryCache() {
  const values = new Map();
  const writes = [];
  return {
    values,
    writes,
    async get(key) { return values.get(key); },
    async set(key, value, options) {
      values.set(key, value);
      writes.push({ key, value, options });
    },
  };
}

test("shared cache serves clean and timestamped variants after one provider extraction", async () => {
  const cache = memoryCache();
  transcriptCache.setBackendForTests(cache);
  const previousFetch = global.fetch;
  const previousProvider = process.env.TRANSCRIPT_PROVIDER;
  const previousKey = process.env.SUPADATA_API_KEY;
  let providerCalls = 0;

  process.env.TRANSCRIPT_PROVIDER = "supadata";
  process.env.SUPADATA_API_KEY = "test-key";
  global.fetch = async (url) => {
    const value = String(url);
    if (value.startsWith("https://api.supadata.ai/")) {
      providerCalls++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          lang: "en",
          content: [
            { offset: 0, text: "Opening idea" },
            { offset: 65_000, text: "Second idea" },
          ],
        }),
      };
    }
    if (value.startsWith("https://www.youtube.com/oembed")) {
      return { ok: true, status: 200, json: async () => ({ title: "Cached video", author_name: "Teacher" }) };
    }
    throw new Error(`unexpected fetch ${value}`);
  };

  try {
    const first = await fetchTranscripts({
      ids: ["abcdefghijk"],
      timestamps: false,
      lang: "en",
    });
    assert.equal(first.ok, true);
    assert.equal(first.provider, "supadata");
    assert.equal(first.transcripts[0].text, "Opening idea Second idea");
    assert.deepEqual(first.cache, {
      layer: "vercel-runtime",
      ttlDays: 30,
      hits: 0,
      misses: 1,
      writes: 1,
    });
    assert.equal(cache.writes.length, 1);
    assert.equal(cache.writes[0].options.ttl, 30 * 24 * 60 * 60);
    assert.match(cache.writes[0].value.text, /^\[0:00\] Opening idea\n\[1:05\] Second idea$/);

    delete process.env.TRANSCRIPT_PROVIDER;
    delete process.env.SUPADATA_API_KEY;
    global.fetch = async () => { throw new Error("provider must not run on a cache hit"); };

    const second = await fetchTranscripts({
      ids: ["abcdefghijk"],
      timestamps: true,
      lang: "en",
    });
    assert.equal(second.ok, true);
    assert.equal(second.provider, "cache");
    assert.equal(second.cache.hits, 1);
    assert.equal(second.cache.misses, 0);
    assert.match(second.transcripts[0].text, /^\[0:00\] Opening idea\n\[1:05\] Second idea$/);
    assert.equal(providerCalls, 1);
  } finally {
    global.fetch = previousFetch;
    if (previousProvider === undefined) delete process.env.TRANSCRIPT_PROVIDER;
    else process.env.TRANSCRIPT_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.SUPADATA_API_KEY;
    else process.env.SUPADATA_API_KEY = previousKey;
    transcriptCache.setBackendForTests(undefined);
  }
});

test("failed transcripts are not written to the shared cache", async () => {
  const cache = memoryCache();
  transcriptCache.setBackendForTests(cache);
  const previousFetch = global.fetch;
  const previousProvider = process.env.TRANSCRIPT_PROVIDER;
  const previousKey = process.env.SUPADATA_API_KEY;
  process.env.TRANSCRIPT_PROVIDER = "supadata";
  process.env.SUPADATA_API_KEY = "test-key";
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [] }),
  });

  try {
    const result = await fetchTranscripts({ ids: ["abcdefghijk"], timestamps: true, lang: "en" });
    assert.equal(result.ok, true);
    assert.equal(result.transcripts[0].ok, false);
    assert.equal(result.cache.writes, 0);
    assert.equal(cache.writes.length, 0);
  } finally {
    global.fetch = previousFetch;
    if (previousProvider === undefined) delete process.env.TRANSCRIPT_PROVIDER;
    else process.env.TRANSCRIPT_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.SUPADATA_API_KEY;
    else process.env.SUPADATA_API_KEY = previousKey;
    transcriptCache.setBackendForTests(undefined);
  }
});
