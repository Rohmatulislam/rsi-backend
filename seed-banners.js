/**
 * Script untuk menambahkan data Banners default ke database
 * Jalankan: node seed-banners.js
 */

require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const defaultBanners = [
    {
        title: 'Selamat Datang di RSI Siti Hajar',
        subtitle: 'Rumah Sakit Islam Terpercaya di Mataram',
        description: 'Memberikan pelayanan kesehatan terbaik dengan sentuhan Islami untuk masyarakat NTB',
        imageUrl: 'https://images.unsplash.com/photo-5194940268 92-80bbd2d6fd0d?w=1920&h=1080&fit=crop',
        link: '/tentang-kami',
        linkText: 'Tentang Kami',
        order: 0,
        isActive: true
    },
    {
        title: 'Layanan Medical Check Up',
        subtitle: 'Paket MCU Lengkap & Terjangkau',
        description: 'Cek kesehatan Anda secara menyeluruh dengan peralatan modern dan dokter berpengalaman',
        imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&h=1080&fit=crop',
        link: '/layanan/mcu',
        linkText: 'Lihat Paket MCU',
        order: 1,
        isActive: true
    },
    {
        title: 'Layanan IGD 24 Jam',
        subtitle: 'Siap Melayani Anda Setiap Saat',
        description: 'Tim medis profesional siaga 24/7 untuk menangani kondisi darurat Anda',
        imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1920&h=1080&fit=crop',
        link: '/igd',
        linkText: 'Info IGD',
        order: 2,
        isActive: true
    },
    {
        title: 'Dokter Spesialis Berpengalaman',
        subtitle: 'Konsultasi dengan Ahlinya',
        description: 'Lebih dari 50 dokter spesialis siap memberikan pelayanan terbaik untuk Anda',
        imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=1920&h=1080&fit=crop',
        link: '/doctors',
        linkText: 'Lihat Dokter',
        order: 3,
        isActive: true
    }
];

async function seedBanners() {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting banner seeding...');

        // Check if banners table exists and has data
        const checkResult = await client.query('SELECT COUNT(*) FROM banners');
        const count = parseInt(checkResult.rows[0].count);

        if (count > 0) {
            console.log(`⚠️  Found ${count} existing banners. Skipping seed.`);
            console.log('   Delete existing banners first if you want to re-seed.');
            return;
        }

        // Insert banners
        for (const banner of defaultBanners) {
            await client.query(
                `INSERT INTO banners (
                    id, title, subtitle, description, "imageUrl", link, "linkText", "order", "isActive", "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
                )`,
                [
                    banner.title,
                    banner.subtitle,
                    banner.description,
                    banner.imageUrl,
                    banner.link,
                    banner.linkText,
                    banner.order,
                    banner.isActive
                ]
            );
            console.log(`✅ Created banner: ${banner.title}`);
        }

        console.log('✨ Banner seeding completed successfully!');
        console.log(`📊 Total banners created: ${defaultBanners.length}`);

    } catch (error) {
        console.error('❌ Error seeding banners:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the seed function
seedBanners()
    .then(() => {
        console.log('👍 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
