// Helper HTTP kecil supaya fungsi API jalan di Vercel maupun server lokal.
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function parseRaw(raw, contentType = "") {
  if (!raw) return {};
  if (contentType.includes("application/json")) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
}

async function readBody(req) {
  const ct = req.headers["content-type"] || "";
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    if (typeof req.body === "string" || Buffer.isBuffer(req.body)) return parseRaw(String(req.body), ct);
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return parseRaw(Buffer.concat(chunks).toString("utf8"), ct);
}

function query(req) {
  return Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
}

function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error(e);
      const msg = String(e && e.message || "");
      // Tampilkan detail error database (tanpa key) supaya mudah dicari penyebabnya.
      send(res, 500, { error: "Terjadi kesalahan di server. Coba lagi sebentar.", detail: msg.startsWith("Supabase") ? msg.slice(0, 300) : undefined });
    }
  };
}

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = { HttpError, readBody, query, send, handler, baseUrl };
