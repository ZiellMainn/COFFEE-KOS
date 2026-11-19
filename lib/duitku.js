// Integrasi Duitku API v2 (QRIS).
// Dokumentasi: https://docs.duitku.com/api/id/
const crypto = require("crypto");
const { safeEqual } = require("./auth");

const md5 = s => crypto.createHash("md5").update(s).digest("hex");

function config() {
  const env = (process.env.DUITKU_ENV || "sandbox").toLowerCase();
  return {
    env,
    merchantCode: process.env.DUITKU_MERCHANT_CODE || "",
    apiKey: process.env.DUITKU_API_KEY || "",
    // Kode metode QRIS di Duitku, cek menu "Payment Method" di dashboard project kamu (contoh: SP, NQ, SQ, GQ).
    method: process.env.DUITKU_PAYMENT_METHOD || "SP",
    base: process.env.DUITKU_BASE_URL || (env === "production" ? "https://passport.duitku.com" : "https://sandbox.duitku.com"),
    ready: !!(process.env.DUITKU_MERCHANT_CODE && process.env.DUITKU_API_KEY),
  };
}

async function post(path, body) {
  const c = config();
  const r = await fetch(c.base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`Duitku ${r.status}: ${text.slice(0, 400)}`);
  return data;
}

/* Buat transaksi QRIS. signature = MD5(merchantCode + merchantOrderId + paymentAmount + apiKey) */
async function createTransaction({ orderId, amount, productDetails, customerName, email, callbackUrl, returnUrl, expiryMinutes }) {
  const c = config();
  const body = {
    merchantCode: c.merchantCode,
    paymentAmount: amount,
    paymentMethod: c.method,
    merchantOrderId: orderId,
    productDetails,
    customerVaName: String(customerName).slice(0, 20),
    email,
    itemDetails: [{ name: productDetails, price: amount, quantity: 1 }],
    callbackUrl,
    returnUrl,
    expiryPeriod: expiryMinutes,
    signature: md5(c.merchantCode + orderId + amount + c.apiKey),
  };
  const data = await post("/webapi/api/merchant/v2/inquiry", body);
  if (data.statusCode !== "00") throw new Error(`Duitku menolak transaksi: ${data.statusMessage || JSON.stringify(data)}`);
  return { reference: data.reference || null, paymentUrl: data.paymentUrl || null, qrString: data.qrString || null };
}

/* Cek status. signature = MD5(merchantCode + merchantOrderId + apiKey). statusCode: 00 sukses, 01 pending, 02 batal */
async function checkStatus(orderId) {
  const c = config();
  const data = await post("/webapi/api/merchant/transactionStatus", {
    merchantCode: c.merchantCode, merchantOrderId: orderId, signature: md5(c.merchantCode + orderId + c.apiKey),
  });
  return { statusCode: data.statusCode, amount: Number(data.amount), reference: data.reference || null };
}

/* Verifikasi callback. signature = MD5(merchantCode + amount + merchantOrderId + apiKey) */
function verifyCallback(p) {
  const c = config();
  if (!c.ready || !p.signature || p.merchantCode !== c.merchantCode) return false;
  const expected = md5(String(p.merchantCode) + String(p.amount) + String(p.merchantOrderId) + c.apiKey);
  return safeEqual(expected, String(p.signature).toLowerCase());
}

module.exports = { config, createTransaction, checkStatus, verifyCallback, md5 };
