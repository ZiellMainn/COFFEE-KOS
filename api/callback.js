// /api/callback — dipanggil OTOMATIS oleh server Duitku setelah pembayaran.
// Inilah satu-satunya jalur (selain cek status ke Duitku & input manual pemilik) yang bisa menandai lunas.
const { readBody, send } = require("../lib/http");
const db = require("../lib/db");
const duitku = require("../lib/duitku");
const { markOrderPaid } = require("../lib/billing");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const p = await readBody(req);
    if (!duitku.verifyCallback(p)) {
      console.warn("Callback Duitku ditolak: signature tidak cocok", p.merchantOrderId);
      return send(res, 400, { error: "Bad signature" });
    }
    const order = await db.getOrder(p.merchantOrderId);
    if (!order) return send(res, 404, { error: "Order not found" });
    if (Number(p.amount) !== order.amount) {
      console.warn("Callback Duitku ditolak: nominal beda", p.merchantOrderId, p.amount, order.amount);
      return send(res, 400, { error: "Amount mismatch" });
    }
    if (p.resultCode === "00") await markOrderPaid(order, p.reference);
    else await db.updateOrder(order.id, { status: "failed" }, ["pending"]);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    return res.end("OK");
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Server error" });
  }
};
