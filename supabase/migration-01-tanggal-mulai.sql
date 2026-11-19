-- Jalankan SEKALI di Supabase (SQL Editor → New query → paste → Run)
-- Menambah kolom tanggal mulai ngekos. Aman dijalankan berulang.
alter table rooms add column if not exists start_date date;
