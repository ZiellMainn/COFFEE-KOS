// Server lokal untuk mencoba di laptop:  node server.js  → buka http://localhost:3000
// (Di Vercel file ini tidak dipakai; Vercel menjalankan folder api/ dan public/ sendiri.)
const http = require("http");
const fs = require("fs");
const path = require("path");

// baca .env sederhana
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const api = url.pathname.match(/^\/api\/([a-z]+)\/?$/);
  if (api) {
    const file = path.join(__dirname, "api", api[1] + ".js");
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
    return require(file)(req, res);
  }
  let p = path.join(__dirname, "public", decodeURIComponent(url.pathname));
  if (!p.startsWith(path.join(__dirname, "public"))) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(__dirname, "public", "index.html");
  res.setHeader("Content-Type", TYPES[path.extname(p)] || "application/octet-stream");
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`KosanKu jalan di http://localhost:${PORT}`));
