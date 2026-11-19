# KosanKu — Website Manajemen Kos + Bayar QRIS (Duitku)

Isi project:

```
public/index.html     ← tampilan website (login, dashboard anak kos, dashboard pemilik)
api/                  ← server (Vercel Functions)
  auth.js             login / logout
  tenant.js           data & akun anak kos
  pay.js              buat QRIS Duitku + cek status
  callback.js         dipanggil Duitku setelah pembayaran berhasil → otomatis LUNAS
  owner.js            fitur pemilik kos
lib/                  kode bersama (database, Duitku, QR, login)
supabase/schema.sql   struktur database (jalankan sekali di Supabase)
server.js             untuk mencoba di laptop (node server.js)
.env.example          daftar pengaturan yang harus diisi
```

Tidak perlu `npm install`, karena project ini tidak memakai paket tambahan.

---

## Langkah 1: Buat database di Supabase (gratis)

1. Daftar di https://supabase.com, lalu klik **New project**. Pilih region **Southeast Asia (Singapore)**.
2. Buka **SQL Editor** → **New query**. Salin seluruh isi `supabase/schema.sql`, tempel, lalu klik **Run**.
   Hasilnya: 10 kamar (`kamar1` … `kamar10`) dengan harga Rp500.000.
3. Buka **Project Settings → API Keys** (atau **API**). Catat:
   - **Project URL**, untuk diisi ke `SUPABASE_URL`
   - **service_role key / secret key**, untuk diisi ke `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ Key ini rahasia. Hanya isi di Vercel, jangan ditaruh di kode atau GitHub.

## Langkah 2: Upload ke GitHub

1. Buat repository baru di GitHub (sebaiknya **Private**).
2. Upload semua isi folder ini. File `.env` jangan ikut diupload; `.gitignore` sudah mengaturnya.

## Langkah 3: Online-kan di Vercel (gratis) → dapat URL website

1. Daftar di https://vercel.com pakai akun GitHub.
2. Klik **Add New → Project**, lalu pilih repo tadi. Framework Preset: **Other**.
3. Buka **Environment Variables** dan isi variabel berikut (lihat `.env.example`):

| Nama | Isi |
|---|---|
| `KOS_NAME` | nama kos, misalnya `Kos Mawar` |
| `DUE_DAY` | tanggal jatuh tempo, misalnya `10` |
| `OWNER_USERNAME` | username pemilik, misalnya `pemilik` |
| `OWNER_PASSWORD` | password pemilik (buat yang kuat) |
| `DEFAULT_ROOM_PASSWORD` | password awal semua kamar sebelum diganti anak kos |
| `SESSION_SECRET` | teks acak minimal 32 karakter |
| `SUPABASE_URL` | dari langkah 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | dari langkah 1 |
| `DUITKU_ENV` | `sandbox` |
| `DUITKU_EMAIL` | email pemilik kos |

4. Klik **Deploy**. Setelah selesai, kamu dapat alamat seperti `https://kos-mawar.vercel.app`.
   Website sudah bisa dibuka dan dipakai login. Bagian pembayaran baru aktif setelah langkah 4.

> Bisa juga pakai domain sendiri (misalnya `kosmawar.com`) di Vercel → Settings → Domains.

## Langkah 4: Daftar & sambungkan Duitku

1. Daftar akun Duitku dan isi **URL website** dengan alamat Vercel dari langkah 3.
2. Di dashboard Duitku, buat **Project** baru. Isi:
   - **Website / URL**: `https://kos-mawar.vercel.app`
   - **Callback URL**: `https://kos-mawar.vercel.app/api/callback`
3. Ambil **Merchant Code** dan **API Key** dari project tersebut.
4. Cek metode pembayaran QRIS yang aktif di project kamu dan catat kodenya (misalnya `SP`, `NQ`, atau `SQ`).
5. Kembali ke Vercel → **Settings → Environment Variables**, lalu tambahkan:

| Nama | Isi |
|---|---|
| `DUITKU_MERCHANT_CODE` | Merchant Code |
| `DUITKU_API_KEY` | API Key |
| `DUITKU_PAYMENT_METHOD` | kode QRIS dari poin 4 |

6. Buka **Deployments**, klik **⋯** di deployment terakhir, lalu pilih **Redeploy**. Variabel yang baru diisi baru terbaca setelah redeploy.

## Langkah 5: Uji di sandbox

1. Login sebagai pemilik, lalu pastikan muncul tulisan "Duitku tersambung dalam mode sandbox".
2. Logout, lalu login sebagai `kamar1` dengan password dari `DEFAULT_ROOM_PASSWORD`.
3. Klik **Bayar Sekarang**. QRIS dengan nominal yang pas akan muncul.
4. Selesaikan pembayaran uji coba memakai simulator atau panduan sandbox dari Duitku. Link "Buka halaman pembayaran Duitku" juga tersedia di bawah QR.
5. Setelah Duitku mengirim callback, layar otomatis berubah jadi **Pembayaran berhasil**, dan di dashboard pemilik kotaknya jadi hijau.

Halaman juga mengecek status ke Duitku setiap beberapa detik, jadi status tetap ter-update kalau callback telat.

## Langkah 6: Mulai terima uang sungguhan

Setelah akun Duitku production disetujui:

1. Ganti `DUITKU_ENV` menjadi `production`.
2. Ganti `DUITKU_MERCHANT_CODE` dan `DUITKU_API_KEY` dengan milik project **production**.
3. Pastikan Callback URL di project production juga `https://…/api/callback`.
4. Redeploy.

---

## Cara pakai sehari-hari

**Anak kos**
- Login pertama kali pakai `kamarX` dan password awal. Website akan meminta mereka mengganti password.
- Username dan nama bisa diganti di kartu **Akun saya**.
- Bayar lewat tombol Bayar → scan QRIS. Bisa beberapa bulan sekaligus.
- Tombol **Kirim tagihan ke orang tua** membuka WhatsApp dengan link pembayaran Duitku.

**Pemilik kos**
- **Ringkasan**: tabel semua kamar × bulan. Klik satu kotak untuk menandai lunas tunai atau membatalkannya.
- **Atur rentang bulan**: tandai lunas atau belum dari bulan X sampai Y (misalnya untuk bulan-bulan sebelum website dipakai).
- **Kamar & Penghuni**: ubah nama, username, harga, dan bulan mulai ngekos. Juga ada **Reset password** dan **Ganti penghuni**.
- **Riwayat**: semua pembayaran, baik QRIS maupun manual.

## Mencoba di laptop (opsional)

```
cp .env.example .env     # isi minimal OWNER_PASSWORD, DEFAULT_ROOM_PASSWORD, SESSION_SECRET
node server.js           # buka http://localhost:3000
```

Kalau `SUPABASE_URL` kosong, data disimpan di file `.data/db.json`. Callback Duitku tidak bisa masuk ke localhost, jadi uji pembayaran sebaiknya langsung di Vercel.

## Keamanan

- Status **Lunas** hanya bisa berasal dari tiga sumber: callback Duitku yang signature-nya valid, hasil cek status langsung ke server Duitku, atau input manual pemilik.
- Password disimpan dalam bentuk hash (scrypt), bukan teks asli.
- API Key Duitku dan key Supabase hanya ada di server (Environment Variables Vercel).
- Tabel database dikunci dengan Row Level Security, jadi tidak bisa dibaca dari luar.
