/* Instagram opens the explicit local tool; no audio, cookies or credentials
   cross the extension boundary. The local service must be running. */
(function (root) {
  function instagramUrlFrom(value) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(u.hostname)
          || u.username || u.password || (u.port && u.port !== '443')) return null;
      const match = u.pathname.match(/^\/(reel|p|tv)\/([A-Za-z0-9_-]{5,64})\/?$/);
      return match ? `https://www.instagram.com/${match[1]}/${match[2]}/` : null;
    } catch { return null; }
  }
  function localToolUrl(value) {
    const clean = instagramUrlFrom(value);
    return clean ? 'http://127.0.0.1:8876/#url=' + encodeURIComponent(clean) : null;
  }

  // Top-level routes that look like usernames but are Instagram pages.
  const RESERVED = new Set(['explore', 'reels', 'reel', 'p', 'tv', 'stories', 'direct', 'accounts',
    'about', 'legal', 'developer', 'web', 'challenge', 'emails', 'session', 'privacy', 'oauth', 'graphql', 'api']);
  function profileFrom(value) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(u.hostname)) return null;
      const match = u.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/(?:reels\/?)?$/);
      if (!match || RESERVED.has(match[1].toLowerCase())) return null;
      return { username: match[1], url: `https://www.instagram.com/${match[1]}/` };
    } catch { return null; }
  }
  // Grid links come as /user/reel/CODE/, /reel/CODE/ or /p/CODE/. First seen wins
  // so the list keeps the page's newest-first order.
  function postsFromHrefs(hrefs) {
    const seen = new Map();
    for (const href of hrefs) {
      const match = String(href || '').match(/(?:^|\/)(reel|p|tv)\/([A-Za-z0-9_-]{5,64})\/?(?:[?#]|$)/);
      if (match && !seen.has(match[2])) {
        seen.set(match[2], { code: match[2], url: `https://www.instagram.com/${match[1] === 'p' ? 'p' : 'reel'}/${match[2]}/` });
      }
    }
    return [...seen.values()];
  }
  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
  }
  // items: [{ code, url, status: 'done'|'no-speech'|'error', result?, error? }]
  function profileMarkdown(profile, items, createdAt) {
    // Grid and Reels tab are merged, so order by post date, newest first.
    items = [...items].sort((a, b) => (b.result?.posted || '').localeCompare(a.result?.posted || ''));
    const done = items.filter(i => i.status === 'done');
    const words = done.reduce((n, i) => n + (i.result?.words || 0), 0);
    const heading = i => {
      const first = (i.result?.caption || '').split('\n')[0].trim().slice(0, 120);
      return [i.result?.posted, first || i.code].filter(Boolean).join(' ');
    };
    const lines = ['---', `profile: ${profile.url}`, `reels_found: ${items.length}`,
      `transcribed: ${done.length}`, `words: ${words}`, `created: ${createdAt}`,
      'source: YouChop local Whisper', 'accuracy: machine transcription, unverified against audio', '---', '',
      `# @${profile.username} Instagram reels`, '',
      `${done.length} of ${items.length} posts transcribed, ${words.toLocaleString('en-US')} words.`, ''];
    for (const i of items) {
      const tag = i.status === 'done' ? `${i.result.words} words` : i.status === 'no-speech' ? 'no speech' : `failed: ${i.error || 'unknown error'}`;
      lines.push(`- [${heading(i)}](${i.url}) | ${tag}`);
    }
    for (const i of done) {
      lines.push('', '---', '', `## ${heading(i)}`, '', `Source: ${i.url}`);
      if (i.result.caption) lines.push('', 'Caption:', '', i.result.caption.trim());
      lines.push('');
      for (const row of i.result.segments || []) lines.push(`[${clock(row.start)}] ${row.text}`);
    }
    return lines.join('\n') + '\n';
  }

  const api = { instagramUrlFrom, localToolUrl, profileFrom, postsFromHrefs, profileMarkdown, clock };
  root.YouChopInstagram = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
