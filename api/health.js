// /api/health — cek pengaturan server & koneksi Supabase (tidak menampilkan isi key).
// Boleh dihapus setelah semuanya jalan.
module.exports = async (req, res) => {
  const need = ["OWNER_PASSWORD", "DEFAULT_ROOM_PASSWORD", "SESSION_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const out = { envKosong: need.filter(n => !process.env[n]) };
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  out.supabaseUrl = url || null;
  out.jenisKey = !key ? "kosong" : key.startsWith("sb_secret_") ? "secret (benar)" : key.startsWith("sb_publishable_") ? "PUBLISHABLE (salah, pakai secret)" : key.startsWith("eyJ") ? "JWT lama" : "tidak dikenal";
  out.adaSpasiDiKey = key !== (process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (url && key) {
    try {
      const headers = { apikey: key };
      if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
      const r = await fetch(url.replace(/\/$/, "") + "/rest/v1/rooms?select=id&order=id.asc", { headers });
      const text = await r.text();
      out.supabaseStatus = r.status;
      out.supabaseJawaban = text.slice(0, 400);
    } catch (e) {
      out.supabaseError = String(e.message || e);
    }
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(out, null, 2));
};
