// /api/owner (khusus pemilik kos)
//   GET                         → semua kamar + semua pembayaran
//   POST ?action=setMonths      {roomIds, from, to, paid}
//   POST ?action=updateRoom     {roomId, name, username, price, startDate}
//   POST ?action=resetPassword  {roomId}
//   POST ?action=newTenant      {roomId, name, startDate, clearFrom}
const { handler, readBody, query, send, HttpError } = require("../lib/http");
const auth = require("../lib/auth");
const db = require("../lib/db");
const duitku = require("../lib/duitku");
const { publicRoom, publicPayment } = require("../lib/billing");
const { currentMonth, isMonth, range } = require("../lib/months");

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;
const isDate = s => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) && !isNaN(Date.parse(s));

/* Simpan perubahan kamar. Kalau kolom start_date belum ada di Supabase, beri petunjuk yang jelas. */
async function saveRoom(id, patch) {
  try { return await db.updateRoom(id, patch); }
  catch (e) {
    if (e instanceof db.DuplicateError) throw e;
    if (/start_date/.test(String(e.message))) throw new HttpError(500, "Database perlu diperbarui sekali: buka Supabase → SQL Editor, lalu jalankan isi file supabase/migration-01-tanggal-mulai.sql.");
    throw e;
  }
}

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
    const startDate = b.startDate || (isMonth(b.startMonth) ? b.startMonth + "-01" : null);
    if (!isDate(startDate)) throw new HttpError(400, "Tanggal mulai ngekos belum diisi dengan benar.");
    try { await saveRoom(r.id, { name, username, price, start_month: startDate.slice(0, 7), start_date: startDate }); }
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
    const name = String(b.name || "").trim() || `Kamar ${r.id}`;
    if (name.length > 40) throw new HttpError(400, "Nama maksimal 40 karakter.");
    const startDate = isDate(b.startDate) ? b.startDate : null;
    const startMonth = startDate ? startDate.slice(0, 7) : currentMonth();
    try {
      await saveRoom(r.id, { name, username: `kamar${r.id}`, password_hash: null, start_month: startMonth, start_date: startDate, token_version: r.token_version + 1 });
      // Kalau penghuni lama sudah bayar di muka, catatan bulan setelah penghuni baru masuk bisa dihapus.
      if (b.clearFrom) await db.deletePayments([r.id], startMonth, "9999-12");
    } catch (e) { if (e instanceof db.DuplicateError) throw new HttpError(400, `Username kamar${r.id} sedang dipakai kamar lain. Ganti dulu username kamar itu.`); throw e; }
    return send(res, 200, { ok: true });
  }

  throw new HttpError(404, "Tidak ditemukan.");
});
