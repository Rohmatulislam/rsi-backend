import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Create connection pool using DIRECT_URL for session mode
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : null;
const adapter = pool ? new PrismaPg(pool) : undefined;

const prisma = new PrismaClient({ adapter } as any);

const banners = [
    {
        title: 'Selamat Datang di RSI Siti Hajar Mataram',
        subtitle: 'Melayani dengan Hati, Menyembuhkan dengan Ilmu',
        imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1600',
        link: '/about',
        order: 1,
        isActive: true,
    },
    {
        title: 'Layanan Medical Check Up',
        subtitle: 'Paket lengkap pemeriksaan kesehatan untuk Anda dan keluarga',
        imageUrl: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=1600',
        link: '/services/medical-check-up',
        order: 2,
        isActive: true,
    },
    {
        title: 'Dokter Spesialis Terbaik',
        subtitle: 'Tim dokter berpengalaman siap melayani Anda',
        imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=1600',
        link: '/doctors',
        order: 3,
        isActive: true,
    },
    {
        title: 'Fasilitas Modern',
        subtitle: 'Dilengkapi dengan peralatan medis terkini',
        imageUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1600',
        link: '/services',
        order: 4,
        isActive: true,
    },
];

async function seedBanners() {
    console.log('🌱 Seeding banners...');

    for (let i = 0; i < banners.length; i++) {
        const banner = banners[i];
        await prisma.banner.upsert({
            where: { id: `banner-seed-${i + 1}` },
            update: {
                title: banner.title,
                subtitle: banner.subtitle,
                imageUrl: banner.imageUrl,
                link: banner.link,
                order: banner.order,
                isActive: banner.isActive,
            },
            create: {
                id: `banner-seed-${i + 1}`,
                title: banner.title,
                subtitle: banner.subtitle,
                imageUrl: banner.imageUrl,
                link: banner.link,
                order: banner.order,
                isActive: banner.isActive,
            },
        });
        console.log(`✅ Created banner: ${banner.title}`);
    }

    console.log(`🎉 Seeded ${banners.length} banners`);
}

async function main() {
    try {
        await seedBanners();
    } catch (error) {
        console.error('Error seeding banners:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        if (pool) await pool.end();
    }
}

main();
