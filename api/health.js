// /api/health — cek pengaturan server & koneksi Supabase (tidak menampilkan isi key).
// Boleh dihapus setelah semuanya jalan.
module.exports = async (req, res) => {
  const need = ["OWNER_PASSWORD", "DEFAULT_ROOM_PASSWORD", "SESSION_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const out = { envKosong: need.filter(n => !process.env[n]) };
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  out.supabaseUrl = url || null;
  out.jenisKey = !key ? "kosong" : key.startsWith("sb_secret_") ? "secret (benar)" : key.startsWith("sb_publishable_") ? "PUBLISHABLE (salah, pakai secret)" : key.startsWith("eyJ") ? "JWT lama" : "tidak dikenal";
  out.adaSpasiDiKey = key !== (process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (url && key) {
    const headers = { apikey: key };
    if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
    out.tabel = {};
    for (const t of ["rooms", "payments", "orders"]) {
      try {
        const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=${t === "rooms" ? 10 : 1}`, { headers });
        const text = await r.text();
        out.tabel[t] = r.ok ? `OK (${JSON.parse(text).length} baris)` : `ERROR ${r.status}: ${text.slice(0, 300)}`;
      } catch (e) {
        out.tabel[t] = "GAGAL KONEK: " + String(e.message || e);
      }
    }
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(out, null, 2));
};
