// /api/auth?action=config | me | login | logout
const { handler, readBody, query, send, HttpError } = require("../lib/http");
const auth = require("../lib/auth");
const db = require("../lib/db");
const duitku = require("../lib/duitku");
const { publicRoom } = require("../lib/billing");
const { currentMonth } = require("../lib/months");

const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = handler(async (req, res) => {
  const { action } = query(req);

  if (action === "config" && req.method === "GET") {
    const c = duitku.config();
    return send(res, 200, {
      kosName: process.env.KOS_NAME || "KosanKu",
      dueDay: Number(process.env.DUE_DAY || 10),
      currentMonth: currentMonth(),
      duitkuEnv: c.env,
      duitkuReady: c.ready,
    });
  }

  if (action === "me" && req.method === "GET") {
    const s = auth.getSession(req);
    if (!s) return send(res, 200, { role: null });
    try {
      if (s.role === "owner") { auth.requireOwner(req); return send(res, 200, { role: "owner", name: process.env.OWNER_NAME || "Pemilik Kos" }); }
      const room = await auth.requireTenant(req);
      return send(res, 200, { role: "tenant", room: publicRoom(room) });
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) { auth.clearSession(res, req); return send(res, 200, { role: null }); }
      throw e;
    }
  }

  if (action === "login" && req.method === "POST") {
    const body = await readBody(req);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!username || !password) throw new HttpError(400, "Username dan password wajib diisi.");

    const owner = auth.ownerCreds();
    if (username === owner.username) {
      if (!auth.safeEqual(password, owner.password)) { await wait(500); throw new HttpError(401, "Username atau password salah."); }
      auth.setSession(res, req, { role: "owner", ov: auth.ownerVersion() });
      return send(res, 200, { role: "owner" });
    }
    const rooms = await db.listRooms();
    const room = rooms.find(r => r.username.toLowerCase() === username);
    if (!room || !auth.checkRoomPassword(room, password)) { await wait(500); throw new HttpError(401, "Username atau password salah."); }
    auth.setSession(res, req, { role: "tenant", roomId: room.id, tv: room.token_version });
    return send(res, 200, { role: "tenant" });
  }

  if (action === "logout" && req.method === "POST") {
    auth.clearSession(res, req);
    return send(res, 200, { ok: true });
  }

  throw new HttpError(404, "Tidak ditemukan.");
});
