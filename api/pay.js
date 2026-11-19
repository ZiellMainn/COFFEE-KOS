// /api/pay?action=create  POST {months:["2026-11",...]} → buat QRIS Duitku
// /api/pay?action=status&orderId=...  GET → status pembayaran (dipanggil berkala oleh halaman)
const crypto = require("crypto");
const { handler, readBody, query, send, HttpError, baseUrl } = require("../lib/http");
const auth = require("../lib/auth");
const db = require("../lib/db");
const duitku = require("../lib/duitku");
const { toSvg } = require("../lib/qr");
const { syncOrder } = require("../lib/billing");
const { currentMonth, addMonths, isMonth, shortLabel } = require("../lib/months");

const EXPIRY_MINUTES = 15;

function orderView(o) {
  return {
    orderId: o.id, months: o.months, amount: o.amount, status: o.status,
    expiresAt: o.expires_at, paymentUrl: o.payment_url,
    qrSvg: o.qr_string ? toSvg(o.qr_string) : null,
  };
}

module.exports = handler(async (req, res) => {
  const room = await auth.requireTenant(req);
  const { action, orderId } = query(req);

  if (action === "create" && req.method === "POST") {
    if (!duitku.config().ready) throw new HttpError(503, "Pembayaran QRIS belum aktif. Hubungi pemilik kos.");
    const b = await readBody(req);
    const months = [...new Set(Array.isArray(b.months) ? b.months : [])].filter(isMonth).sort();
    if (!months.length) throw new HttpError(400, "Pilih minimal satu bulan.");
    if (months.length > 12) throw new HttpError(400, "Maksimal 12 bulan sekali bayar.");
    const cur = currentMonth();
    for (const m of months) {
      if (room.start_month && m < room.start_month) throw new HttpError(400, "Ada bulan sebelum kamu mulai ngekos.");
      if (m > addMonths(cur, 11)) throw new HttpError(400, "Bulan terlalu jauh ke depan.");
    }
    const paid = new Set((await db.listPayments(room.id)).map(p => p.month));
    if (months.some(m => paid.has(m))) throw new HttpError(409, "Sebagian bulan sudah lunas. Muat ulang halaman.");

    const amount = room.price * months.length;
    const id = `KOS${room.id}-${months[0].replace("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const product = `Sewa Kamar ${room.id} - ${months.map(shortLabel).join(", ")}`.slice(0, 255);
    const url = baseUrl(req);

    let trx;
    try {
      trx = await duitku.createTransaction({
        orderId: id, amount, productDetails: product, customerName: room.name,
        email: process.env.DUITKU_EMAIL || "pembayaran@kos.local",
        callbackUrl: `${url}/api/callback`, returnUrl: `${url}/`,
        expiryMinutes: EXPIRY_MINUTES,
      });
    } catch (e) {
      console.error(e);
      throw new HttpError(502, "Gagal membuat QRIS dari Duitku. Coba lagi sebentar.");
    }
    const order = await db.createOrder({
      id, room_id: room.id, months, amount, status: "pending",
      reference: trx.reference, qr_string: trx.qrString, payment_url: trx.paymentUrl,
      expires_at: new Date(Date.now() + EXPIRY_MINUTES * 60000).toISOString(),
    });
    return send(res, 200, orderView(order));
  }

  if (action === "status" && req.method === "GET") {
    let order = orderId ? await db.getOrder(orderId) : null;
    if (!order || order.room_id !== room.id) throw new HttpError(404, "Transaksi tidak ditemukan.");
    order = await syncOrder(order);
    const v = orderView(order); delete v.qrSvg;
    return send(res, 200, v);
  }

  throw new HttpError(404, "Tidak ditemukan.");
});
