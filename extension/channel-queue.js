/* Shared queue selection and a self-contained MAIN-world public channel reader. */
var YCQueue = {
  select(videos, options) {
    const count = Number(options.count), min = Number(options.min || 0), max = Number(options.max || 0);
    if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('Choose 1–50 videos.');
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0 || (max && max < min)) {
      throw new Error('Use valid durations; maximum must be at least minimum.');
    }
    const seen = new Set(), query = String(options.query || '').trim().toLowerCase();
    return videos.filter(v => {
      if (!/^[\w-]{11}$/.test(v.videoId) || seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      if (query && !String(v.title || '').toLowerCase().includes(query)) return false;
      if ((min || max) && (!Number.isFinite(v.seconds) || v.seconds < min * 60 || (max && v.seconds > max * 60))) return false;
      return true;
    }).slice(0, count);
  },
  watchUrl(videos) {
    const ids = [...new Set(videos.map(v => v.videoId).filter(id => /^[\w-]{11}$/.test(id)))].slice(0, 50);
    if (!ids.length) throw new Error('Build a queue first.');
    return 'https://www.youtube.com/watch_videos?video_ids=' + ids.join(',');
  },
  // Serialized by executeScript: keep all dependencies inside this function.
  page: async function (options) {
    try {
    const walk = (node, predicate) => {
      if (!node || typeof node !== 'object') return null;
      if (predicate(node)) return node;
      for (const value of Object.values(node)) {
        const match = walk(value, predicate);
        if (match) return match;
      }
      return null;
    };
    const text = x => typeof x === 'string' ? x : x?.simpleText || x?.content || (x?.runs || []).map(r => r.text).join('');
    const duration = node => {
      const match = walk(node, x => typeof x.text === 'string' && /^\d+:\d{2}(?::\d{2})?$/.test(x.text));
      const raw = match?.text;
      return raw ? raw.split(':').reduce((n, p) => n * 60 + Number(p), 0) : null;
    };
    if (!/^(?:@[\w.-]+|channel\/UC[\w-]{22}|(?:c|user)\/[\w.-]+)$/.test(options.ref || '')) throw new Error('Open a YouTube channel first.');
    if (!['latest', 'popular', 'oldest'].includes(options.sort)) throw new Error('Unknown channel order.');
    const request = async token => {
      const context = globalThis.ytcfg?.get?.('INNERTUBE_CONTEXT');
      if (!context) throw new Error('YouTube is still loading. Try again.');
      const r = await fetch('/youtubei/v1/browse?prettyPrint=false', {
        method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { ...context, client: { ...context.client, hl: 'en' } }, continuation: token }),
      });
      if (!r.ok) throw new Error(`YouTube listing HTTP ${r.status}. Try again later.`);
      return r.json();
    };
    let data, title = '';
    if (options.cursor) data = await request(options.cursor);
    else {
      const r = await fetch('/' + options.ref + '/videos?hl=en', { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`YouTube channel HTTP ${r.status}`);
      const html = await r.text();
      const marker = /(?:var\s+)?ytInitialData\s*=\s*/g;
      let match;
      while ((match = marker.exec(html))) {
        const start = marker.lastIndex;
        if (html[start] !== '{') continue;
        let depth = 0, quoted = false, escaped = false;
        for (let i = start; i < html.length; i++) {
          const c = html[i];
          if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
          else if (c === '"') quoted = true;
          else if (c === '{') depth++;
          else if (c === '}' && --depth === 0) { data = JSON.parse(html.slice(start, i + 1)); break; }
        }
        if (data) break;
      }
      if (!data) throw new Error('Could not read this channel’s video list.');
      title = data.metadata?.channelMetadataRenderer?.title || options.ref;
      const tab = walk(data.contents, x => x.tabRenderer?.selected)?.tabRenderer;
      const grid = walk(tab?.content, x => x.richGridRenderer)?.richGridRenderer;
      if (!grid) throw new Error('This channel has no Videos tab to queue.');
      const label = { latest: 'Latest', popular: 'Popular', oldest: 'Oldest' }[options.sort];
      const chipNode = walk(grid.header, x => {
        const c = x.chipViewModel || x.chipCloudChipRenderer;
        return c && text(c.text) === label;
      });
      const chip = chipNode?.chipViewModel || chipNode?.chipCloudChipRenderer;
      if (!chip) throw new Error(`YouTube does not offer ${label} sorting for this channel.`);
      if (!(chip.selected || chip.isSelected)) {
        const token = walk(chip, x => x.continuationCommand?.token)?.continuationCommand.token;
        if (!token) throw new Error('YouTube’s sorting control changed. Please retry later.');
        data = await request(token);
      } else data = grid;
    }
    // Only list feed items, never video IDs buried in menus or recommendations.
    const feed = data.contents || walk(data, x => x.reloadContinuationItemsCommand &&
      x.reloadContinuationItemsCommand.slot !== 'RELOAD_CONTINUATION_SLOT_HEADER')?.reloadContinuationItemsCommand?.continuationItems ||
      walk(data, x => x.appendContinuationItemsAction)?.appendContinuationItemsAction?.continuationItems;
    if (!Array.isArray(feed)) throw new Error('YouTube returned an unfamiliar video list.');
    const videos = [];
    let cursor = null;
    for (const item of feed) {
      const next = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (next) { cursor = next; continue; }
      const card = item.richItemRenderer?.content || item;
      const v = card.videoRenderer, lk = card.lockupViewModel;
      const id = v?.videoId || (lk?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' ? lk.contentId : null);
      if (!/^[\w-]{11}$/.test(id || '')) continue;
      videos.push({ videoId: id, title: text(v?.title || lk?.metadata?.lockupMetadataViewModel?.title) || id,
        seconds: v?.lengthText ? duration({ text: text(v.lengthText) }) : duration(lk?.contentImage) });
    }
    return { videos, cursor, title };
    } catch (error) { return { error: String(error?.message || error) }; }
  },
};
if (typeof module !== 'undefined') module.exports = YCQueue;
