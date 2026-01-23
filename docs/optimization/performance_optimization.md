# Optimasi Kinerja Halaman Rawat Jalan

Dokumen ini menjelaskan perubahan yang telah dilakukan untuk meningkatkan kinerja pemuatan data di halaman rawat jalan.

## Masalah
Halaman rawat jalan memiliki waktu pemuatan yang lama karena query ke database SIMRS Khanza yang kurang optimal.

## Solusi yang Diimplementasikan

### 1. Implementasi Caching
- Ditambahkan cache lokal di `PoliklinikService` dengan durasi 5 menit
- Mengurangi jumlah panggilan langsung ke database SIMRS

### 2. Optimasi Query Database
- Query `getPoliklinikWithActiveSchedules()` dioptimalkan untuk hanya mengambil jadwal hari ini
- Menambahkan kondisi WHERE untuk memfilter berdasarkan rentang waktu
- Tetap mempertahankan JOIN yang diperlukan untuk mengambil informasi poliklinik

### 3. Rekomendasi Indeks Database
- Disarankan pembuatan beberapa indeks di tabel `jadwal` dan `poliklinik` untuk meningkatkan kinerja query
- File `suggested_indexes.sql` berisi perintah SQL yang bisa digunakan untuk membuat indeks-indeks tersebut

## File yang Diubah
- `src/infra/database/khanza/sync/poliklinik.service.ts` - Implementasi caching dan optimasi query

## Cara Kerja Cache
Cache lokal menyimpan hasil query selama 5 menit. Setiap permintaan baru akan:
1. Memeriksa apakah data tersedia di cache dan masih valid (< 5 menit)
2. Jika ya, kembalikan data dari cache
3. Jika tidak, lakukan query ke database SIMRS, simpan hasilnya ke cache, lalu kembalikan

## Pengujian Kinerja
Disarankan untuk melakukan pengujian kinerja sebelum dan sesudah implementasi untuk mengukur peningkatan yang diberikan.