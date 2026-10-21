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
