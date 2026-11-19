// Mengubah qrString dari Duitku menjadi gambar QR (SVG).
// Encoder QR: kode Kazuhiko Arase (lisensi di lib/qrcode/LICENSE).
const QRCode = require("./qrcode");
const ECL = require("./qrcode/QRErrorCorrectLevel");

function toSvg(text) {
  const qr = new QRCode(-1, ECL.M);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), q = 4;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  const s = n + q * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}

module.exports = { toSvg };
