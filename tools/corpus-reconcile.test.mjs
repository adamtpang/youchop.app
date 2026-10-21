import test from 'node:test';
import assert from 'node:assert/strict';
import { pageIdentity, captionText, uniqueVideos, reuseSnapshot } from './corpus-reconcile.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('resume reuses recovered transcripts, ignores missing files, and preserves existing cache', () => {
  const directory = mkdtempSync(join(tmpdir(), 'corpus-reuse-'));
  try {
    const transcript = join(directory, 'recovered.md');
    writeFileSync(transcript, 'Recovered transcript content. '.repeat(10));
    const manifest = join(directory, 'manifest.json');
    writeFileSync(manifest, JSON.stringify({ episodes: [
      { id: 'TUN8Y8__QGU', path: transcript, status: 'fetched-local-recovery' },
      { id: 'BA_fC95p43c', path: join(directory, 'absent.md') },
      { id: '5-G9WHwQMwQ', path: transcript },
      { id: 'AoE1yX9ogCM', path: null }
    ] }));
    const byId = new Map([['5-G9WHwQMwQ', 'existing-cache.md']]);
    reuseSnapshot(byId, manifest);
    assert.equal(byId.get('TUN8Y8__QGU'), transcript);
    assert.equal(byId.get('5-G9WHwQMwQ'), 'existing-cache.md');
    assert.equal(byId.size, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test('ID, not title or popularity rank, is the identity', () => {
  assert.equal(pageIdentity('---\nvideo_id: "BaWUPamqWlA"\n---\n\nContent').id, 'BaWUPamqWlA');
  assert.equal(pageIdentity('No frontmatter'), null);
});
test('short uploads remain eligible and duplicate IDs collapse', () => {
  assert.equal(uniqueVideos([{ id: 'BaWUPamqWlA', duration: 20 }, { id: 'BaWUPamqWlA' }, { id: 'bad' }]).length, 1);
});
test('captions preserve text without append duplicates', () => {
  assert.equal(captionText({ events: [{ segs: [{ utf8: 'hello\nworld' }] }, { aAppend: 1, segs: [{ utf8: 'world' }] }] }), 'hello world');
});
