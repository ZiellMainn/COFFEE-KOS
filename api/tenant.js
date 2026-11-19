// /api/tenant            GET  → data kamar + riwayat bayar milik anak kos yang login
// /api/tenant?action=account POST → ganti nama, username, password
const { handler, readBody, query, send, HttpError } = require("../lib/http");
const auth = require("../lib/auth");
const db = require("../lib/db");
const { publicRoom, publicPayment } = require("../lib/billing");
const { currentMonth } = require("../lib/months");

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;

module.exports = handler(async (req, res) => {
  const room = await auth.requireTenant(req);
  const { action } = query(req);

  if (!action && req.method === "GET") {
    const payments = await db.listPayments(room.id);
    return send(res, 200, { room: publicRoom(room), payments: payments.map(publicPayment), currentMonth: currentMonth() });
  }

  if (action === "account" && req.method === "POST") {
    const b = await readBody(req);
    const name = String(b.name || "").trim();
    const username = String(b.username || "").trim();
    const oldPassword = String(b.oldPassword || "");
    const newPassword = String(b.newPassword || "");
    if (!name || name.length > 40) throw new HttpError(400, "Nama wajib diisi (maks. 40 karakter).");
    if (!USERNAME_RE.test(username)) throw new HttpError(400, "Username 3–24 karakter: huruf, angka, titik, atau garis bawah.");
    if (username.toLowerCase() === auth.ownerCreds().username) throw new HttpError(400, "Username itu tidak bisa dipakai.");

    const patch = { name, username };
    let relogin = false;
    if (newPassword) {
      if (!auth.checkRoomPassword(room, oldPassword)) throw new HttpError(400, "Password lama salah.");
      if (newPassword.length < 6) throw new HttpError(400, "Password baru minimal 6 karakter.");
      patch.password_hash = auth.hashPassword(newPassword);
      patch.token_version = room.token_version + 1;
      relogin = true;
    }
    let updated;
    try { updated = await db.updateRoom(room.id, patch); }
    catch (e) { if (e instanceof db.DuplicateError) throw new HttpError(400, "Username itu sudah dipakai kamar lain."); throw e; }
    if (relogin) auth.setSession(res, req, { role: "tenant", roomId: updated.id, tv: updated.token_version });
    return send(res, 200, { room: publicRoom(updated) });
  }

  throw new HttpError(404, "Tidak ditemukan.");
});
