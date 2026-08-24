/* Minimal local stand-in for Vercel: serves the static site and routes /api/* to
   the serverless handlers, so the extract page can be exercised for real. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
                ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon",
                ".png": "image/png", ".txt": "text/plain" };

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  let p = decodeURIComponent(u.pathname);

  if (p.startsWith("/api/")) {
    const name = p.slice(5).replace(/[^\w-]/g, "");
    const file = path.join(ROOT, "api", name + ".js");
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end("no such api"); }
    delete require.cache[require.resolve(file)];
    const handler = require(file);
    req.query = u.query; // real req/res, so req.on(...) still works for POST bodies
    const shim = {
      _headers: {},
      status(c) { this._c = c; return this; },
      setHeader(k, v) { this._headers[k] = v; return this; },
      json(b) {
        res.writeHead(this._c || 200, { "content-type": "application/json", ...this._headers });
        res.end(JSON.stringify(b));
      },
      end(b) {
        res.writeHead(this._c || 200, this._headers);
        res.end(b);
      },
    };
    try { await handler(req, shim); }
    catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
    return;
  }

  if (p === "/") p = "/index.html";
  if (p === "/extract") p = "/extract.html";
  if (p === "/creators") p = "/creators.html";
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

// 4321 is Astro's default, so a sibling Astro project (pangaea.blog) grabs it
// first and this server then fails to bind. Default off it, and honour PORT so
// the harness can move the server without editing code.
const PORT = Number(process.env.PORT) || 4325;
server.listen(PORT, () => console.log(`youchop dev server on http://localhost:${PORT}`));
