/** Non-destructive, video-ID based channel reconciliation. No hosted provider.
 * node tools/corpus-reconcile.mjs --cache PATH --out PRIVATE_NEW_DIRECTORY [--reuse MANIFEST] [--sync]
 * Defaults to @StarterStory/videos, including videos under 20 minutes.
 * Leaves the old corpus untouched. The output is a fresh private index referencing
 * cached pages, with any newly fetched captions stored alongside it.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function pageIdentity(text) {
  const match = text.match(/^video_id:\s*"?([\w-]{11})"?\s*$/m);
  const end = text.indexOf('\n---', 4);
  return match && end > 0 ? { id: match[1], body: text.slice(end + 4).trim() } : null;
}
export function captionText(data) {
  return (data.events || []).filter(e => !e.aAppend)
    .map(e => (e.segs || []).map(s => s.utf8 || '').join('').trim())
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
export function uniqueVideos(entries) {
  return [...new Map(entries.filter(e => /^[\w-]{11}$/.test(e.id)).map(e => [e.id, e])).values()];
}

export function reuseSnapshot(byId, manifestPath) {
  const report = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const item of report.episodes || []) {
    if (!/^[\w-]{11}$/.test(item.id) || !item.path || byId.has(item.id)) continue;
    if (existsSync(item.path) && readFileSync(item.path, 'utf8').trim().length > 100) {
      byId.set(item.id, item.path);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  if (value('--recover-local')) {
    const directory = resolve(value('--recover-local'));
    const reportPath = join(directory, 'manifest.json');
    const original = readFileSync(reportPath, 'utf8');
    const report = JSON.parse(original);
    writeFileSync(join(directory, `manifest-before-recovery-${Date.now()}.json`), original, { flag: 'wx' });
    for (const item of report.episodes.filter(e => !e.path)) {
      const subs = join(directory, '_subs');
      const file = existsSync(subs) && readdirSync(subs).find(f => f.startsWith(item.id + '.') && f.endsWith('.json3'));
      if (!file) continue;
      let text;
      try { text = captionText(JSON.parse(readFileSync(join(subs, file), 'utf8'))); } catch { continue; }
      if (text.length < 100) continue;
      item.path = join(directory, item.id + '.md');
      writeFileSync(item.path, `# ${item.title}\n\nSource: ${item.url}\n\nPrivate transcript input. Do not republish.\n\n${text}\n`, { flag: 'wx' });
      item.status = 'fetched-local-recovery';
    }
    report.summary.available = report.episodes.filter(e => e.path).length;
    report.summary.missing = report.episodes.filter(e => !e.path).length;
    report.summary.fetched = report.episodes.filter(e => e.status.startsWith('fetched')).length;
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    writeFileSync(join(directory, 'INDEX.md'), `# ${report.channel} reconciled private corpus\n\n${report.checkedAt}\n\n${report.scope}\n\nAvailable: ${report.summary.available}/${report.summary.listed}. Rate-limit stop remains in force.\n\n` + report.episodes.map(e => `- ${e.status}: [${e.title}](${e.url})${e.path ? ` | [local transcript](<${e.path.replaceAll('\\', '/')}> )` : ''}`).join('\n'));
    console.log(JSON.stringify(report.summary));
    return;
  }
  if (!value('--cache') || !value('--out')) throw new Error('--cache and --out required');
  const cache = resolve(value('--cache')), out = resolve(value('--out'));
  if (existsSync(out)) throw new Error('Use a new output directory; previous snapshots are preserved.');
  const channel = value('--channel', '@StarterStory');
  if (!/^@[\w.-]+$/.test(channel)) throw new Error('Expected a YouTube @handle');
  const python = process.env.PYTHON || 'python';
  const ytdlp = args => execFileSync(python, ['-m', 'yt_dlp', ...args], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 90000,
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  const source = `https://www.youtube.com/${channel}/videos`;
  const listing = JSON.parse(ytdlp(['--flat-playlist', '--no-warnings', '-J', source]));
  const entries = uniqueVideos(listing.entries || []);
  if (!entries.length) throw new Error('Empty listing; not a successful sync.');
  const pages = join(cache, 'brain', 'pages');
  const byId = new Map();
  for (const file of readdirSync(pages).filter(f => f.endsWith('.md'))) {
    const path = join(pages, file), identity = pageIdentity(readFileSync(path, 'utf8'));
    if (identity && identity.body.length > 100) byId.set(identity.id, path);
  }
  if (value('--reuse')) reuseSnapshot(byId, resolve(value('--reuse')));
  mkdirSync(out, { recursive: true });
  const report = { channel, source, checkedAt: new Date().toISOString(),
    scope: 'Public /videos uploads, all durations. Excludes /shorts, /streams, other channels and the paid website library.',
    cachedUniqueIds: byId.size, episodes: [] };
  let stopped = false;
  for (const entry of entries) {
    const item = { id: entry.id, title: entry.title, url: `https://www.youtube.com/watch?v=${entry.id}`,
      durationSeconds: entry.duration ?? null, status: 'missing', path: byId.get(entry.id) || null };
    if (item.path) item.status = 'cached';
    else if (args.includes('--sync') && !stopped) {
      const subs = join(out, '_subs');
      mkdirSync(subs, { recursive: true });
      try {
        ytdlp(['--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', 'en',
          '--sub-format', 'json3', '--sleep-requests', '2', '--retries', '0',
          '-o', join(subs, '%(id)s.%(ext)s'), item.url]);
        const file = readdirSync(subs).find(f => f.startsWith(entry.id + '.') && f.endsWith('.json3'));
        const text = file ? captionText(JSON.parse(readFileSync(join(subs, file), 'utf8'))) : '';
        if (text.length > 100) {
          item.path = join(out, entry.id + '.md');
          writeFileSync(item.path, `# ${entry.title}\n\nSource: ${item.url}\n\nPrivate transcript input. Do not republish.\n\n${text}\n`, { flag: 'wx' });
          item.status = 'fetched';
        } else item.status = 'no-captions';
      } catch (error) {
        const message = String(error.stderr || error.message);
        stopped = /429|403|sign in|bot|captcha|rate.limit/i.test(message);
        item.status = stopped ? 'blocked' : 'fetch-error';
        item.error = message.replace(/https?:\/\/\S+/g, '[url]').slice(-600);
      }
      console.log(JSON.stringify({ id: item.id, status: item.status, title: item.title }));
    }
    report.episodes.push(item);
    writeFileSync(join(out, 'manifest.json'), JSON.stringify(report, null, 2));
  }
  report.summary = { listed: entries.length, available: report.episodes.filter(e => e.path).length,
    fetched: report.episodes.filter(e => e.status === 'fetched').length,
    missing: report.episodes.filter(e => !e.path).length, stoppedOnAccessError: stopped };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(out, 'INDEX.md'), `# ${channel} reconciled private corpus\n\n${report.checkedAt}\n\n${report.scope}\n\nAvailable: ${report.summary.available}/${entries.length}.\n\n` + report.episodes.map(e => `- ${e.status}: [${e.title}](${e.url})${e.path ? ` | [local transcript](<${e.path.replaceAll('\\', '/')}> )` : ''}`).join('\n'));
  console.log(JSON.stringify(report.summary));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
