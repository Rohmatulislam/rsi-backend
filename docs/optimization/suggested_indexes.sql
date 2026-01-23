-- Usulan Indeks untuk Meningkatkan Kinerja Query SIMRS Khanza
-- File ini berisi rekomendasi indeks untuk tabel-tabel yang digunakan dalam query rawat jalan

-- 1. Indeks untuk tabel jadwal (untuk mendukung query getPoliklinikWithActiveSchedules)
-- Query utama kita mencari jadwal yang aktif berdasarkan tanggal dan melakukan join dengan tabel poliklinik
CREATE INDEX IF NOT EXISTS idx_jadwal_kd_poli ON jadwal(kd_poli);
CREATE INDEX IF NOT EXISTS idx_jadwal_jam_mulai_jam_selesai ON jadwal(jam_mulai, jam_selesai);
CREATE INDEX IF NOT EXISTS idx_jadwal_date_range ON jadwal(jam_mulai, jam_selesai, kd_poli);

-- 2. Indeks untuk tabel poliklinik (untuk mendukung join dengan tabel jadwal)
-- Kolom kd_poli digunakan dalam join dan select
CREATE INDEX IF NOT EXISTS idx_poliklinik_kd_poli ON poliklinik(kd_poli);

-- 3. Indeks komposit untuk query yang sering digunakan bersamaan
-- Jika query juga memfilter berdasarkan status atau jenis layanan
-- CREATE INDEX IF NOT EXISTS idx_jadwal_kd_poli_status ON jadwal(kd_poli, status);

-- Catatan:
-- 1. Pastikan untuk menguji kinerja sebelum dan sesudah penerapan indeks
-- 2. Indeks akan sedikit memperlambat operasi INSERT/UPDATE/DELETE, tetapi akan mempercepat operasi SELECT
-- 3. Monitor penggunaan storage karena indeks akan memakan ruang tambahan