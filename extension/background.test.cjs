const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function worker(overrides = {}) {
  const listeners = [];
  let main;
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const context = vm.createContext({
    chrome: {
      runtime: {
        onInstalled: { addListener() {} },
        onMessage: { addListener(fn) { listeners.push(fn); } },
      },
      scripting: { executeScript({ func }) { main = func; return pending; } },
    },
    setTimeout, clearTimeout, ...overrides,
  });
  context.importScripts = filename => vm.runInContext(fs.readFileSync(require.resolve('./' + filename), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('./background.js'), 'utf8'), context);
  return { request: (...args) => listeners.some(listener => listener(...args) === true), main: () => main, finish };
}

test('worker responds to a stalled page once and ignores late MAIN completion', async () => {
  let timeout;
  const responses = [];
  const w = worker({
    setTimeout(fn, ms) { assert.equal(ms, 12000); timeout = fn; return 1; },
    clearTimeout() {},
  });
  assert.equal(w.request({ type: 'youchop-transcript-context' }, { tab: { id: 7 } }, r => responses.push(r)), true);
  timeout();
  assert.equal(responses[0].debug.stage, 'timeout');
  w.finish([{ result: { ok: true } }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(responses.length, 1);
});

test('channel reader errors cross the MAIN-world bridge as usable errors', async () => {
  const responses = [];
  const w = worker();
  assert.equal(w.request({ type: 'youchop-channel-page', options: { ref: '@test', sort: 'oldest' } },
    { tab: { id: 7 } }, result => responses.push(result)), true);
  w.finish([{ result: { error: 'YouTube listing HTTP 429. Try again later.' } }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(responses[0].ok, false);
  assert.match(responses[0].error, /429/);
});

test('native wait exits after a throttled timer and does not issue a stale fallback', async () => {
  let now = 0, timerCalls = 0, fetches = 0;
  const continuation = { triggerContinuation() {}, data: {} };
  const panel = {
    getAttribute(name) { return name === 'target-id' ? 'transcript' : 'EXPANDED'; },
    querySelector: () => continuation,
    querySelectorAll: () => [],
    textContent: '',
  };
  const w = worker({
    Date: { now: () => now },
    document: { querySelectorAll: () => [panel] },
    setTimeout(fn, ms) {
      if (ms === 12000) return 1; // worker watchdog is tested separately
      timerCalls++;
      now += 60000; // the background tab wakes only once a minute
      fn();
      return 2;
    },
    clearTimeout() {},
    fetch() { fetches++; throw new Error('unexpected fallback'); },
  });
  w.request({ type: 'youchop-transcript-context' }, { tab: { id: 7 } }, () => {});
  const result = await w.main()();
  assert.equal(result.ok, false);
  assert.match(result.error, /timed out/);
  assert.equal(timerCalls, 1);
  assert.equal(fetches, 0);
});
