-- SQL script to insert banner data
-- Run this in Prisma Studio or pgAdmin

INSERT INTO banners (id, title, subtitle, description, "imageUrl", link, "linkText", "order", "isActive", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid()::text,
    'Selamat Datang di RSI Siti Hajar',
    'Rumah Sakit Islam Terpercaya di Mataram',
    'Memberikan pelayanan kesehatan terbaik dengan sentuhan Islami untuk masyarakat NTB',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1920&h=1080&fit=crop',
    '/tentang-kami',
    'Tentang Kami',
    0,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'Layanan Medical Check Up',
    'Paket MCU Lengkap & Terjangkau',
    'Cek kesehatan Anda secara menyeluruh dengan peralatan modern dan dokter berpengalaman',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&h=1080&fit=crop',
    '/layanan/mcu',
    'Lihat Paket MCU',
    1,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'Layanan IGD 24 Jam',
    'Siap Melayani Anda Setiap Saat',
    'Tim medis profesional siaga 24/7 untuk menangani kondisi darurat Anda',
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1920&h=1080&fit=crop',
    '/igd',
    'Info IGD',
    2,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'Dokter Spesialis Berpengalaman',
    'Konsultasi dengan Ahlinya',
    'Lebih dari 50 dokter spesialis siap memberikan pelayanan terbaik untuk Anda',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=1920&h=1080&fit=crop',
    '/doctors',
    'Lihat Dokter',
    3,
    true,
    NOW(),
    NOW()
  );
