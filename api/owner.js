// /api/owner (khusus pemilik kos)
//   GET                         → semua kamar + semua pembayaran
//   POST ?action=setMonths      {roomIds, from, to, paid}
//   POST ?action=updateRoom     {roomId, name, username, price, startMonth}
//   POST ?action=resetPassword  {roomId}
//   POST ?action=newTenant      {roomId}
const { handler, readBody, query, send, HttpError } = require("../lib/http");
const auth = require("../lib/auth");
const db = require("../lib/db");
const duitku = require("../lib/duitku");
const { publicRoom, publicPayment } = require("../lib/billing");
const { currentMonth, isMonth, range } = require("../lib/months");

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;

module.exports = handler(async (req, res) => {
  auth.requireOwner(req);
  const { action } = query(req);

  if (!action && req.method === "GET") {
    const [rooms, payments] = await Promise.all([db.listRooms(), db.listPayments()]);
    const c = duitku.config();
    return send(res, 200, {
      rooms: rooms.map(publicRoom), payments: payments.map(publicPayment),
      currentMonth: currentMonth(), duitku: { env: c.env, ready: c.ready, method: c.method },
    });
  }
  if (req.method !== "POST") throw new HttpError(404, "Tidak ditemukan.");
  const b = await readBody(req);
  const rooms = await db.listRooms();
  const roomById = id => { const r = rooms.find(x => x.id === Number(id)); if (!r) throw new HttpError(404, "Kamar tidak ditemukan."); return r; };

  if (action === "setMonths") {
    const ids = (Array.isArray(b.roomIds) ? b.roomIds : []).map(id => roomById(id).id);
    if (!ids.length) throw new HttpError(400, "Pilih kamar.");
    if (!isMonth(b.from) || !isMonth(b.to) || b.from > b.to) throw new HttpError(400, "Rentang bulan tidak valid.");
    const months = range(b.from, b.to);
    if (months.length > 120) throw new HttpError(400, "Rentang terlalu panjang (maks. 10 tahun).");
    if (b.paid) {
      const now = new Date().toISOString();
      const rows = [];
      for (const id of ids) {
        const r = roomById(id);
        for (const m of months) if (!r.start_month || m >= r.start_month) rows.push({ room_id: id, month: m, method: "manual", amount: r.price, paid_at: now, order_id: null });
      }
      await db.addPayments(rows);
    } else {
      await db.deletePayments(ids, b.from, b.to);
    }
    return send(res, 200, { ok: true });
  }

  if (action === "updateRoom") {
    const r = roomById(b.roomId);
    const name = String(b.name || "").trim();
    const username = String(b.username || "").trim();
    const price = Number(b.price);
    if (!name || name.length > 40) throw new HttpError(400, "Nama wajib diisi (maks. 40 karakter).");
    if (!USERNAME_RE.test(username)) throw new HttpError(400, "Username 3–24 karakter: huruf, angka, titik, atau garis bawah.");
    if (username.toLowerCase() === auth.ownerCreds().username) throw new HttpError(400, "Username itu tidak bisa dipakai.");
    if (!Number.isInteger(price) || price < 10000 || price > 100000000) throw new HttpError(400, "Harga tidak valid.");
    if (!isMonth(b.startMonth)) throw new HttpError(400, "Bulan mulai tidak valid.");
    try { await db.updateRoom(r.id, { name, username, price, start_month: b.startMonth }); }
    catch (e) { if (e instanceof db.DuplicateError) throw new HttpError(400, "Username sudah dipakai kamar lain."); throw e; }
    return send(res, 200, { ok: true });
  }

  if (action === "resetPassword") {
    const r = roomById(b.roomId);
    await db.updateRoom(r.id, { password_hash: null, token_version: r.token_version + 1 });
    return send(res, 200, { ok: true });
  }

  if (action === "newTenant") {
    const r = roomById(b.roomId);
    try {
      await db.updateRoom(r.id, { name: `Kamar ${r.id}`, username: `kamar${r.id}`, password_hash: null, start_month: currentMonth(), token_version: r.token_version + 1 });
    } catch (e) { if (e instanceof db.DuplicateError) throw new HttpError(400, `Username kamar${r.id} sedang dipakai kamar lain. Ganti dulu username kamar itu.`); throw e; }
    return send(res, 200, { ok: true });
  }

  throw new HttpError(404, "Tidak ditemukan.");
});
