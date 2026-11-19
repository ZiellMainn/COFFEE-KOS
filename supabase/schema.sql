-- =====================================================================
-- KosanKu — jalankan SEKALI di Supabase: menu "SQL Editor" → New query → paste → Run
-- =====================================================================

create table if not exists rooms (
  id            int primary key,
  name          text not null,
  username      text not null,
  password_hash text,                       -- kosong = masih pakai DEFAULT_ROOM_PASSWORD
  price         int  not null default 500000,
  start_month   text,                       -- format YYYY-MM (mulai ngekos)
  token_version int  not null default 0     -- naik saat password diganti/reset → sesi lama keluar
);
create unique index if not exists rooms_username_lower on rooms (lower(username));

create table if not exists orders (
  id          text primary key,             -- merchantOrderId yang dikirim ke Duitku
  room_id     int  not null references rooms(id),
  months      text[] not null,
  amount      int  not null,
  status      text not null default 'pending',   -- pending | paid | failed | expired
  reference   text,
  qr_string   text,
  payment_url text,
  expires_at  timestamptz,
  last_check  timestamptz,
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists orders_room on orders(room_id, created_at desc);

create table if not exists payments (
  room_id  int  not null references rooms(id),
  month    text not null,                   -- YYYY-MM
  method   text not null check (method in ('qris','manual')),
  amount   int,
  order_id text references orders(id),
  paid_at  timestamptz not null default now(),
  primary key (room_id, month)
);

-- 10 kamar awal: username kamar1 … kamar10, harga Rp500.000, mulai bulan ini
insert into rooms (id, name, username, price, start_month)
select i, 'Kamar ' || i, 'kamar' || i, 500000, to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM')
from generate_series(1, 10) as i
on conflict (id) do nothing;

-- Kunci tabel dari akses publik. Hanya server (service_role key) yang boleh baca/tulis.
alter table rooms    enable row level security;
alter table orders   enable row level security;
alter table payments enable row level security;
