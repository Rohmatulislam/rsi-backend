import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

async function fixAdminUser() {
  console.log('Memperbaiki akun admin...');

  // Buat pool dan adapter seperti yang digunakan di PrismaService
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);

  // Inisialisasi PrismaClient dengan adapter
  const prisma = new PrismaClient({
    adapter: adapter as any,
  });

  try {
    // Hapus user dan account yang salah
    const adminEmail = 'admin@rsi.id';
    
    // Dapatkan user
    const user = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true }
    });

    if (user) {
      console.log('Menghapus user lama:', user.id);
      
      // Hapus semua account terkait
      await prisma.account.deleteMany({
        where: { userId: user.id }
      });
      
      // Hapus user
      await prisma.user.delete({
        where: { id: user.id }
      });
      
      console.log('User lama berhasil dihapus.');
    } else {
      console.log('User admin tidak ditemukan, akan dibuat baru.');
    }

    // Sekarang kita akan membuat user baru menggunakan metode sign up dari aplikasi
    console.log('\nSilakan buat akun admin baru melalui antarmuka registrasi');
    console.log('atau gunakan endpoint API langsung saat aplikasi berjalan.');
    console.log('\nAtau, Anda bisa mencoba login dengan kredensial berikut (jika sistem auth sudah berjalan):');
    console.log('Email: admin@rsi.id');
    console.log('Password: admin123');
    
  } catch (error) {
    console.error('Error saat memperbaiki akun admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Jalankan fungsi perbaikan
fixAdminUser().catch(e => {
  console.error(e);
  process.exit(1);
});