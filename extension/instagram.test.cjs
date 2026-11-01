const test = require('node:test');
const assert = require('node:assert/strict');
const { instagramUrlFrom, localToolUrl } = require('./instagram.js');
test('Instagram handoff strips tracking and session query parameters', () => {
  const input = 'https://www.instagram.com/reel/DeKieZFiL7e/?utm_source=copy&stkn=private';
  assert.equal(instagramUrlFrom(input), 'https://www.instagram.com/reel/DeKieZFiL7e/');
  assert.equal(new URL(localToolUrl(input)).hash.includes('private'), false);
});
test('Instagram handoff accepts video post routes and rejects lookalike hosts and credentials', () => {
  assert.equal(instagramUrlFrom('https://instagram.com/p/ABC123/'), 'https://www.instagram.com/p/ABC123/');
  for (const url of ['https://instagram.com.evil.test/reel/ABC123/', 'https://user:pass@instagram.com/reel/ABC123/', 'http://instagram.com/reel/ABC123/', 'https://instagram.com/profile/', 'https://instagram.com/reel/ABC123/extra', 'https://instagram.com:8443/reel/ABC123/']) {
    assert.equal(instagramUrlFrom(url), null);
    assert.equal(localToolUrl(url), null);
  }
});
const { profileFrom, postsFromHrefs, profileMarkdown } = require('./instagram.js');
test('profile detection accepts usernames and the reels tab, rejects posts and Instagram routes', () => {
  assert.deepEqual(profileFrom('https://www.instagram.com/getripping/'), { username: 'getripping', url: 'https://www.instagram.com/getripping/' });
  assert.equal(profileFrom('https://www.instagram.com/getripping/reels/').username, 'getripping');
  for (const url of ['https://www.instagram.com/explore/', 'https://www.instagram.com/reel/ABC123/', 'https://www.instagram.com/getripping/tagged/', 'https://instagram.com.evil.test/getripping/', 'http://www.instagram.com/getripping/']) {
    assert.equal(profileFrom(url), null, url);
  }
});
test('grid links dedupe by code in page order and ignore non-post links', () => {
  const posts = postsFromHrefs(['/getripping/reel/DfNDxQ7PpaK/', '/explore/', '/reel/DfNDxQ7PpaK/', '/p/DeAklBWh727/', null, '/getripping/followers/']);
  assert.deepEqual(posts.map(p => p.code), ['DfNDxQ7PpaK', 'DeAklBWh727']);
  assert.equal(posts[0].url, 'https://www.instagram.com/reel/DfNDxQ7PpaK/');
  assert.equal(posts[1].url, 'https://www.instagram.com/p/DeAklBWh727/');
});
test('profile Markdown lists every post, includes only spoken transcripts, and has no em dashes', () => {
  const md = profileMarkdown({ username: 'getripping', url: 'https://www.instagram.com/getripping/' }, [
    { code: 'AAAAA1', url: 'https://www.instagram.com/reel/AAAAA1/', status: 'done', result: { words: 3, posted: '2026-10-29', caption: 'Sell the job\nmore', segments: [{ start: 65, text: 'sell the job' }] } },
    { code: 'BBBBB2', url: 'https://www.instagram.com/reel/BBBBB2/', status: 'no-speech', result: { words: 0, segments: [] } },
    { code: 'CCCCC3', url: 'https://www.instagram.com/p/CCCCC3/', status: 'error', error: 'Photo-only post' },
  ], '2026-11-01T00:00:00Z');
  assert.match(md, /transcribed: 1/);
  assert.match(md, /## 2026-10-29 Sell the job/);
  assert.match(md, /\[1:05\] sell the job/);
  assert.match(md, /BBBBB2.*no speech/s);
  assert.match(md, /failed: Photo-only post/);
  assert.equal(md.includes('—'), false);
});
