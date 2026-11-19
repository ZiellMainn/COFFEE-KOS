// Bulan disimpan sebagai teks "YYYY-MM". Semua perhitungan pakai zona waktu WIB.
const TZ = "Asia/Jakarta";
const NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function currentMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(date);
  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  return `${y}-${m}`;
}
function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
const isMonth = s => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
function range(from, to) {
  const out = [];
  for (let k = from; k <= to && out.length < 240; k = addMonths(k, 1)) out.push(k);
  return out;
}
function label(key) {
  const [y, m] = key.split("-").map(Number);
  return `${NAMA[m - 1]} ${y}`;
}
function shortLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${NAMA[m - 1].slice(0, 3)} ${y}`;
}

module.exports = { currentMonth, addMonths, isMonth, range, label, shortLabel };
