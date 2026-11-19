// Password hashing (scrypt) dan sesi login berbasis cookie yang ditandatangani (HMAC).
const crypto = require("crypto");
const { HttpError } = require("./http");
const db = require("./db");

const COOKIE = "kos_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Pengaturan server belum lengkap: ${name} belum diisi.`);
  return v;
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 32).toString("hex");
  return `scrypt$${salt}$${h}`;
}
function verifyHash(pw, stored) {
  if (!stored) return false;
  const [alg, salt, h] = stored.split("$");
  if (alg !== "scrypt" || !salt || !h) return false;
  const calc = crypto.scryptSync(pw, salt, 32);
  const hb = Buffer.from(h, "hex");
  return hb.length === calc.length && crypto.timingSafeEqual(hb, calc);
}
function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/* Password kamar: kalau belum pernah diganti (password_hash kosong) pakai DEFAULT_ROOM_PASSWORD */
function checkRoomPassword(room, pw) {
  if (!room.password_hash) return safeEqual(pw, requireEnv("DEFAULT_ROOM_PASSWORD"));
  return verifyHash(pw, room.password_hash);
}

function ownerCreds() {
  return { username: (process.env.OWNER_USERNAME || "pemilik").toLowerCase(), password: requireEnv("OWNER_PASSWORD") };
}
function ownerVersion() {
  const { username, password } = ownerCreds();
  return crypto.createHash("sha256").update(username + ":" + password + ":" + requireEnv("SESSION_SECRET")).digest("hex").slice(0, 16);
}

const b64 = s => Buffer.from(s).toString("base64url");
function sign(payload) {
  const data = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  const sig = crypto.createHmac("sha256", requireEnv("SESSION_SECRET")).update(data).digest("base64url");
  return `${data}.${sig}`;
}
function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", requireEnv("SESSION_SECRET")).update(data).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString());
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

function isHttps(req) {
  return (req.headers["x-forwarded-proto"] || "").startsWith("https") || !!process.env.VERCEL;
}
function setSession(res, req, payload) {
  const parts = [`${COOKIE}=${sign(payload)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${MAX_AGE}`];
  if (isHttps(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearSession(res, req) {
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttps(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
function getSession(req) {
  const raw = req.headers.cookie || "";
  const m = raw.split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
  return m ? verifyToken(m.slice(COOKIE.length + 1)) : null;
}

async function requireTenant(req) {
  const s = getSession(req);
  if (!s || s.role !== "tenant") throw new HttpError(401, "Silakan login dulu.");
  const room = await db.getRoom(s.roomId);
  if (!room || room.token_version !== s.tv) throw new HttpError(401, "Sesi berakhir. Silakan login lagi.");
  return room;
}
function requireOwner(req) {
  const s = getSession(req);
  if (!s || s.role !== "owner" || s.ov !== ownerVersion()) throw new HttpError(401, "Silakan login sebagai pemilik.");
  return true;
}

module.exports = { hashPassword, checkRoomPassword, ownerCreds, ownerVersion, setSession, clearSession, getSession, requireTenant, requireOwner, safeEqual, requireEnv };
