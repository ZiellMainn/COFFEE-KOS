// Logika tagihan yang dipakai beberapa endpoint.
const db = require("./db");
const duitku = require("./duitku");

const publicRoom = r => ({
  id: r.id, no: r.id, name: r.name, username: r.username, price: r.price,
  startMonth: r.start_month, usingDefaultPassword: !r.password_hash,
});
const publicPayment = p => ({ roomId: p.room_id, month: p.month, method: p.method, paidAt: p.paid_at, orderId: p.order_id, amount: p.amount });

/* Tandai order lunas (dipanggil dari callback Duitku ATAU dari cek status ke Duitku).
   Aman dipanggil berkali-kali: hanya order yang belum "paid" yang diproses. */
async function markOrderPaid(order, reference) {
  const paidAt = new Date().toISOString();
  const updated = await db.updateOrder(order.id, { status: "paid", paid_at: paidAt, reference: reference || order.reference }, ["pending", "expired", "failed"]);
  if (!updated || !updated.length) return false;
  const per = Math.round(order.amount / order.months.length);
  await db.addPayments(order.months.map(month => ({ room_id: order.room_id, month, method: "qris", order_id: order.id, amount: per, paid_at: paidAt })));
  return true;
}

/* Tanya status langsung ke Duitku (cadangan kalau callback telat/gagal). */
async function syncOrder(order) {
  if (order.status === "paid" || !duitku.config().ready) return order;
  const last = order.last_check ? Date.parse(order.last_check) : 0;
  if (Date.now() - last < 8000) return order;
  await db.updateOrder(order.id, { last_check: new Date().toISOString() });
  try {
    const st = await duitku.checkStatus(order.id);
    if (st.statusCode === "00" && st.amount === order.amount) {
      await markOrderPaid(order, st.reference);
    } else if (st.statusCode === "02") {
      await db.updateOrder(order.id, { status: "failed" }, ["pending"]);
    }
  } catch (e) {
    console.error("Cek status Duitku gagal:", e.message);
  }
  return db.getOrder(order.id);
}

module.exports = { publicRoom, publicPayment, markOrderPaid, syncOrder };
