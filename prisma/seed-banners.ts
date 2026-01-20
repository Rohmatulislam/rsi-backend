import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
} as any);

async function main() {
    console.log('Seeding banners...');

    // Delete existing banners first
    await prisma.banner.deleteMany({});

    const banners = [
        {
            title: 'Selamat Datang di RSI Siti Hajar Mataram',
            subtitle: 'Pelayanan Kesehatan Islami & Profesional',
            imageUrl: '/images/banner-1.jpg',
            linkText: 'Buat Janji Temu',
            link: '/doctors',
            isActive: true,
            order: 1,
        },
        {
            title: 'Layanan Medical Check Up',
            subtitle: 'Paket pemeriksaan kesehatan lengkap untuk Anda dan keluarga',
            imageUrl: '/images/banner-2.jpg',
            linkText: 'Lihat Paket MCU',
            link: '/layanan/mcu',
            isActive: true,
            order: 2,
        },
        {
            title: 'Ruang Rawat Inap Nyaman',
            subtitle: 'Berbagai pilihan kamar untuk kenyamanan perawatan Anda',
            imageUrl: '/images/banner-3.jpg',
            linkText: 'Lihat Fasilitas',
            link: '/layanan/rawat-inap',
            isActive: true,
            order: 3,
        },
    ];

    for (const banner of banners) {
        await prisma.banner.create({
            data: banner,
        });
    }

    console.log(`Seeded ${banners.length} banners.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

