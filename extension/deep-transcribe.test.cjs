const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const YC = require('./lib.js');

test('readiness distinguishes untimed, truncated, inconsistent and plausible captions', () => {
  const check = (times, duration) => YC.transcriptReadiness(times.map(t => ({ t, text: 'speech' })), { duration });
  assert.equal(check([], 120).ready, false);
  assert.equal(check([0, 0], 120).ready, false);
  assert.equal(check([undefined, 40], 60).ready, false);
  assert.equal(check([0, 20], 120).ready, false);
  assert.equal(check([0, 110, 100], 120).ready, false);
  assert.equal(check([0, 200], 120).ready, false);
  assert.equal(check([0, 110], 0).ready, false);
  assert.equal(check([0, 10, 110], 120).ready, false);
  assert.equal(check([0, 50, 110], 120).ready, true);
});

function bridge(fetch) {
  let listener;
  vm.runInNewContext(fs.readFileSync(require.resolve('./deep-transcribe.js'), 'utf8'), {
    chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
    fetch, URL, AbortSignal,
  });
  return (message, sender = { url: 'https://www.youtube.com/watch?v=miTYqqZnrXE', tab: { id: 1 } }) =>
    new Promise(resolve => listener({ type: 'youchop-deep-transcribe', videoId: 'miTYqqZnrXE', ...message }, sender, resolve));
}

test('bridge starts a canonical local job without disclosing its session token', async () => {
  const calls = [];
  const send = bridge(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => calls.length === 1 ? { token: 'local-secret', protocol: 2 } : { id: 'a'.repeat(32) } };
  });
  const response = await send({ action: 'start' });
  assert.equal(response.ok, true);
  assert.equal(JSON.stringify(response).includes('local-secret'), false);
  assert.equal(calls[1].url, 'http://127.0.0.1:8876/api/jobs');
  assert.equal(JSON.parse(calls[1].options.body).url, 'https://www.youtube.com/watch?v=miTYqqZnrXE');
  assert.equal(calls[1].options.headers['X-YouChop-Token'], 'local-secret');
});

test('bridge rejects changed pages and path injection before fetching; reports offline/old service', async () => {
  let calls = 0;
  const send = bridge(async () => { calls++; throw new Error('network'); });
  assert.equal((await send({ videoId: 'XXXXXXXXXXX', action: 'start' })).ok, false);
  assert.equal((await send({ action: 'status', jobId: '../session' })).ok, false);
  assert.equal(calls, 0);
  assert.match((await send({ action: 'start' })).error, /npm run transcribe/);
  const old = bridge(async () => ({ ok: true, json: async () => ({ token: 'old' }) }));
  assert.match((await old({ action: 'start' })).error, /Restart/);
});

function igBridge(fetch) {
  let listener;
  const IG = require('./instagram.js');
  vm.runInNewContext(fs.readFileSync(require.resolve('./deep-transcribe.js'), 'utf8'), {
    chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
    fetch, URL, AbortSignal, YouChopInstagram: IG,
  });
  return (message, sender = { url: 'https://www.instagram.com/getripping/', tab: { id: 1 } }) =>
    new Promise(resolve => listener({ type: 'youchop-instagram-transcribe', ...message }, sender, resolve));
}

test('Instagram profile bridge sends only a canonical post URL and rejects other origins', async () => {
  const calls = [];
  const send = igBridge(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => calls.length === 1 ? { token: 't', protocol: 2 } : { id: 'b'.repeat(32) } };
  });
  const ok = await send({ action: 'start', url: 'https://www.instagram.com/reel/DfNDxQ7PpaK/?igsh=private' });
  assert.equal(ok.ok, true);
  assert.equal(JSON.parse(calls[1].options.body).url, 'https://www.instagram.com/reel/DfNDxQ7PpaK/');
  const before = calls.length;
  assert.equal((await send({ action: 'start', url: 'https://evil.test/reel/ABC123/' })).ok, false);
  assert.equal((await send({ action: 'start', url: 'https://www.instagram.com/reel/DfNDxQ7PpaK/' }, { url: 'https://evil.test/', tab: { id: 1 } })).ok, false);
  assert.equal((await send({ action: 'status', jobId: '../session' })).ok, false);
  assert.equal(calls.length, before);
});
