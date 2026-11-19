// Akses database.
// - Di Vercel: pakai Supabase (isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY).
// - Di laptop tanpa Supabase: otomatis pakai file .data/db.json (untuk coba-coba lokal).
const fs = require("fs");
const path = require("path");
const { currentMonth } = require("./months");

class DuplicateError extends Error {}
const useSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
// Rapikan URL: buang spasi, garis miring di akhir, dan "/rest/v1" kalau ikut tertempel.
const supaUrl = () => process.env.SUPABASE_URL.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");

/* ======================= SUPABASE (REST) ======================= */
async function sb(p, { method = "GET", body, prefer } = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const headers = { apikey: key, "Content-Type": "application/json" };
  // Key lama (JWT "eyJ...") juga dikirim sebagai Bearer; key baru ("sb_secret_...") cukup di header apikey.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;
  const url = supaUrl() + "/rest/v1" + p;
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!r.ok) {
    if (data && data.code === "23505") throw new DuplicateError("duplicate");
    throw new Error(`Supabase ${r.status}: ${text}`);
  }
  return data;
}
const enc = encodeURIComponent;

const supa = {
  listRooms: () => sb("/rooms?select=*&order=id.asc"),
  getRoom: async id => (await sb(`/rooms?select=*&id=eq.${Number(id)}`))[0] || null,
  updateRoom: async (id, patch) => (await sb(`/rooms?id=eq.${Number(id)}`, { method: "PATCH", body: patch, prefer: "return=representation" }))[0],
  listPayments: roomId => sb(`/payments?select=*${roomId ? `&room_id=eq.${Number(roomId)}` : ""}&order=month.asc`),
  addPayments: async rows => {
    if (!rows.length) return;
    await sb("/payments?on_conflict=room_id,month", { method: "POST", body: rows, prefer: "resolution=ignore-duplicates,return=minimal" });
  },
  deletePayments: (roomIds, from, to) =>
    sb(`/payments?room_id=in.(${roomIds.map(Number).join(",")})&and=(month.gte.${from},month.lte.${to})`, { method: "DELETE", prefer: "return=minimal" }),
  createOrder: async o => (await sb("/orders", { method: "POST", body: o, prefer: "return=representation" }))[0],
  getOrder: async id => (await sb(`/orders?select=*&id=eq.${enc(id)}`))[0] || null,
  updateOrder: async (id, patch, onlyStatuses) => {
    const f = onlyStatuses ? `&status=in.(${onlyStatuses.join(",")})` : "";
    return sb(`/orders?id=eq.${enc(id)}${f}`, { method: "PATCH", body: patch, prefer: "return=representation" });
  },
};

/* ======================= FILE LOKAL (dev) ======================= */
const FILE = path.join(process.cwd(), ".data", "db.json");
function readLocal() {
  if (!fs.existsSync(FILE)) {
    const price = Number(process.env.ROOM_PRICE || 500000);
    const rooms = Array.from({ length: Number(process.env.ROOM_COUNT || 10) }, (_, i) => ({
      id: i + 1, name: `Kamar ${i + 1}`, username: `kamar${i + 1}`, password_hash: null,
      price, start_month: currentMonth(), token_version: 0,
    }));
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ rooms, payments: [], orders: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
const writeLocal = d => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
const clone = x => JSON.parse(JSON.stringify(x));

const local = {
  async listRooms() { return clone(readLocal().rooms); },
  async getRoom(id) { return clone(readLocal().rooms.find(r => r.id === Number(id)) || null); },
  async updateRoom(id, patch) {
    const d = readLocal();
    if (patch.username && d.rooms.some(r => r.id !== Number(id) && r.username.toLowerCase() === patch.username.toLowerCase())) throw new DuplicateError("duplicate");
    const r = d.rooms.find(r => r.id === Number(id));
    Object.assign(r, patch); writeLocal(d); return clone(r);
  },
  async listPayments(roomId) {
    return clone(readLocal().payments.filter(p => !roomId || p.room_id === Number(roomId)).sort((a, b) => a.month.localeCompare(b.month)));
  },
  async addPayments(rows) {
    const d = readLocal();
    for (const row of rows) if (!d.payments.some(p => p.room_id === row.room_id && p.month === row.month)) d.payments.push({ paid_at: new Date().toISOString(), ...row });
    writeLocal(d);
  },
  async deletePayments(roomIds, from, to) {
    const d = readLocal(), ids = roomIds.map(Number);
    d.payments = d.payments.filter(p => !(ids.includes(p.room_id) && p.month >= from && p.month <= to));
    writeLocal(d);
  },
  async createOrder(o) { const d = readLocal(); const row = { created_at: new Date().toISOString(), status: "pending", ...o }; d.orders.push(row); writeLocal(d); return clone(row); },
  async getOrder(id) { return clone(readLocal().orders.find(o => o.id === id) || null); },
  async updateOrder(id, patch, onlyStatuses) {
    const d = readLocal(); const o = d.orders.find(o => o.id === id);
    if (!o || (onlyStatuses && !onlyStatuses.includes(o.status))) return [];
    Object.assign(o, patch); writeLocal(d); return [clone(o)];
  },
};

module.exports = new Proxy({ DuplicateError }, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return (useSupabase() ? supa : local)[prop];
  },
});
