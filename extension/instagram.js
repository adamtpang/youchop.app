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
  const api = { instagramUrlFrom, localToolUrl };
  root.YouChopInstagram = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
