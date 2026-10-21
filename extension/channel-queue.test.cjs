const test = require('node:test');
const assert = require('node:assert/strict');
const Queue = require('./channel-queue.js');

test('filters before limiting, keeps source order, and deduplicates video IDs', () => {
  const videos = [
    { videoId: 'aaaaaaaaaaa', title: 'Short tutorial', seconds: 60 },
    { videoId: 'bbbbbbbbbbb', title: 'SaaS lessons', seconds: 1200 },
    { videoId: 'bbbbbbbbbbb', title: 'SaaS duplicate', seconds: 1200 },
    { videoId: 'ccccccccccc', title: 'SAAS story', seconds: 1800 },
    { videoId: 'ddddddddddd', title: 'SaaS unknown', seconds: null },
  ];
  assert.deepEqual(Queue.select(videos, { count: 2, min: 10, max: 30, query: 'saas' }).map(v => v.videoId), ['bbbbbbbbbbb', 'ccccccccccc']);
  assert.equal(Queue.select(videos, { count: 50 }).length, 4);
  assert.throws(() => Queue.select(videos, { count: 0 }), /1–50/);
  assert.throws(() => Queue.select(videos, { count: 5, min: 20, max: 10 }), /durations/);
});

test('watch URL preserves queue order and rejects empty or invalid IDs', () => {
  assert.equal(Queue.watchUrl([{ videoId: 'bbbbbbbbbbb' }, { videoId: 'aaaaaaaaaaa' }, { videoId: 'bbbbbbbbbbb' }]),
    'https://www.youtube.com/watch_videos?video_ids=bbbbbbbbbbb,aaaaaaaaaaa');
  assert.throws(() => Queue.watchUrl([{ videoId: 'bad&list=WL' }]), /Build a queue/);
});

const card = (id, title, clock) => ({ richItemRenderer: { content: { lockupViewModel: {
  contentId: id, contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
  metadata: { lockupMetadataViewModel: { title: { content: title } } },
  contentImage: { overlays: [{ thumbnailBadgeViewModel: { text: clock } }] },
} } } });
const next = token => ({ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token } } } });

test('popular and oldest request their native sort token, then preserve paginated feed order', async () => {
  // Chrome serializes the function into MAIN; method shorthand is not a valid expression.
  const page = Function('return (' + Queue.page.toString() + ')')();
  const originalFetch = global.fetch, originalConfig = global.ytcfg;
  const chips = ['Latest', 'Popular', 'Oldest'].map(label => ({ chipViewModel: {
    text: label, selected: label === 'Latest', tapCommand: { innertubeCommand: { continuationCommand: { token: label } } },
  } }));
  const data = { metadata: { channelMetadataRenderer: { title: 'Test channel' } }, contents: {
    tabs: [{ tabRenderer: { selected: true, content: { richGridRenderer: {
      header: { chipBarViewModel: { chips } }, contents: [card('aaaaaaaaaaa', 'Latest } quoted " title', '1:02')],
    } } } }],
  } };
  let requests = [];
  global.ytcfg = { get: () => ({ client: { clientName: 'WEB' } }) };
  global.fetch = async (url, options) => {
    if (!options.method) return { ok: true, text: async () => '<script>var ytInitialData = ' + JSON.stringify(data) + ';</script>' };
    const body = JSON.parse(options.body); requests.push(body.continuation);
    const items = body.continuation === 'next' ? [card('ccccccccccc', 'Second', '1:02:03')] :
      [card('bbbbbbbbbbb', body.continuation + ' first', '12:34'), next('next')];
    return { ok: true, json: async () => ({ onResponseReceivedActions: [{
      reloadContinuationItemsCommand: { slot: 'RELOAD_CONTINUATION_SLOT_HEADER', continuationItems: [{ chipBarViewModel: { chips } }] },
    }, {
      [body.continuation === 'next' ? 'appendContinuationItemsAction' : 'reloadContinuationItemsCommand']: { continuationItems: items },
    }] }) };
  };
  try {
    const latest = await page({ ref: '@test', sort: 'latest' });
    assert.equal(latest.videos[0].seconds, 62);
    assert.equal(requests.length, 0);
    for (const sort of ['popular', 'oldest']) {
      const first = await page({ ref: '@test', sort });
      assert.equal(first.videos[0].videoId, 'bbbbbbbbbbb');
      assert.equal(first.videos[0].seconds, 754);
      assert.equal(first.cursor, 'next');
      const second = await page({ ref: '@test', sort, cursor: first.cursor });
      assert.equal(second.videos[0].seconds, 3723);
      assert.equal(second.cursor, null);
    }
    assert.deepEqual(requests, ['Popular', 'next', 'Oldest', 'next']);
    assert.match((await Queue.page({ ref: '../account', sort: 'latest' })).error, /channel/);
    assert.match((await Queue.page({ ref: '@test', sort: 'random' })).error, /order/);
  } finally { global.fetch = originalFetch; global.ytcfg = originalConfig; }
});
