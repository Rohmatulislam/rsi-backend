import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBanners() {
    console.log('🌱 Seeding banners...');

    const banners = [
        {
            title: 'Selamat Datang di RSI Siti Hajar',
            subtitle: 'Rumah Sakit Islam Terpercaya di Mataram',
            description: 'Memberikan pelayanan kesehatan terbaik dengan sentuhan Islami untuk masyarakat NTB',
            imageUrl: 'https://images.unsplash.com/photo-5194940268 92-80bbd2d6fd0d?w=1920&h=1080&fit=crop',
            link: '/tentang-kami',
            linkText: 'Tentang Kami',
            order: 0,
            isActive: true,
        },
        {
            title: 'Layanan Medical Check Up',
            subtitle: 'Paket MCU Lengkap & Terjangkau',
            description: 'Cek kesehatan Anda secara menyeluruh dengan peralatan modern dan dokter berpengalaman',
            imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&h=1080&fit=crop',
            link: '/layanan/mcu',
            linkText: 'Lihat Paket MCU',
            order: 1,
            isActive: true,
        },
        {
            title: 'Layanan IGD 24 Jam',
            subtitle: 'Siap Melayani Anda Setiap Saat',
            description: 'Tim medis profesional siaga 24/7 untuk menangani kondisi darurat Anda',
            imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1920&h=1080&fit=crop',
            link: '/igd',
            linkText: 'Info IGD',
            order: 2,
            isActive: true,
        },
        {
            title: 'Dokter Spesialis Berpengalaman',
            subtitle: 'Konsultasi dengan Ahlinya',
            description: 'Lebih dari 50 dokter spesialis siap memberikan pelayanan terbaik untuk Anda',
            imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=1920&h=1080&fit=crop',
            link: '/doctors',
            linkText: 'Lihat Dokter',
            order: 3,
            isActive: true,
        },
        {
            title: 'Fasilitas Rawat Inap Modern',
            subtitle: 'Kenyamanan Seperti di Rumah',
            description: 'Kamar rawat inap dengan fasilitas lengkap dan suasana yang nyaman',
            imageUrl: 'https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=1920&h=1080&fit=crop',
            link: '/layanan/rawat-inap',
            linkText: 'Lihat Fasilitas',
            order: 4,
            isActive: false,
        },
    ];

    for (const banner of banners) {
        const created = await prisma.banner.create({
            data: banner,
        });
        console.log(`✅ Created banner: ${created.title}`);
    }

    console.log('✨ Banner seeding completed!');
}

async function main() {
    try {
        await seedBanners();
    } catch (error) {
        console.error('❌ Error seeding banners:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
