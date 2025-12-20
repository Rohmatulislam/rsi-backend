/**
 * Script untuk menambahkan data Services default ke database
 * Jalankan di server production: node seed-services.js
 */

require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const defaultServices = [
    {
        name: 'Laboratorium',
        slug: 'laboratorium',
        title: 'Laboratorium',
        subtitle: 'Pemeriksaan Lab Akurat',
        description: 'Layanan pemeriksaan laboratorium dengan hasil akurat dan cepat.',
        icon: 'FlaskConical',
        isActive: true,
        isFeatured: false,
        order: 1
    },
    {
        name: 'Radiologi',
        slug: 'radiologi',
        title: 'Radiologi',
        subtitle: 'Diagnostik Imaging',
        description: 'Layanan pemeriksaan X-Ray, CT Scan, USG dan lainnya.',
        icon: 'Radio',
        isActive: true,
        isFeatured: false,
        order: 2
    },
    {
        name: 'MCU',
        slug: 'mcu',
        title: 'Medical Check Up',
        subtitle: 'Paket Kesehatan Lengkap',
        description: 'Paket pemeriksaan kesehatan menyeluruh untuk deteksi dini penyakit.',
        icon: 'ClipboardCheck',
        isActive: true,
        isFeatured: false,
        order: 3
    },
    {
        name: 'Rawat Jalan',
        slug: 'rawat-jalan',
        title: 'Rawat Jalan',
        subtitle: 'Poliklinik Spesialis',
        description: 'Konsultasi dan pemeriksaan dengan dokter spesialis.',
        icon: 'Stethoscope',
        isActive: true,
        isFeatured: false,
        order: 4
    },
    {
        name: 'Rawat Inap',
        slug: 'rawat-inap',
        title: 'Rawat Inap',
        subtitle: 'Fasilitas Lengkap',
        description: 'Layanan perawatan pasien dengan fasilitas kamar lengkap dan nyaman.',
        icon: 'Building2',
        isActive: true,
        isFeatured: false,
        order: 5
    },
    {
        name: 'Poli Eksekutif',
        slug: 'poli-executive',
        title: 'Poliklinik Eksekutif',
        subtitle: 'Layanan Premium',
        description: 'Pelayanan premium dengan fasilitas eksklusif dan waktu tunggu minimal.',
        icon: 'Crown',
        isActive: true,
        isFeatured: true,
        order: 6
    },
    {
        name: 'Farmasi',
        slug: 'farmasi',
        title: 'Farmasi 24 Jam',
        subtitle: 'Apotek Lengkap',
        description: 'Layanan apotek yang beroperasi sepanjang waktu.',
        icon: 'Pill',
        isActive: true,
        isFeatured: false,
        order: 7
    },
    {
        name: 'Rehabilitasi Medik',
        slug: 'rehabilitasi-medik',
        title: 'Rehabilitasi Medik',
        subtitle: 'Fisioterapi & Pemulihan',
        description: 'Layanan fisioterapi dan pemulihan fungsi tubuh.',
        icon: 'Heart',
        isActive: true,
        isFeatured: false,
        order: 8
    }
];

async function seedServices() {
    console.log('🌱 Seeding default services...\n');

    const client = await pool.connect();

    try {
        for (const service of defaultServices) {
            // Check if service already exists
            const existing = await client.query(
                `SELECT id FROM "Service" WHERE slug = $1`,
                [service.slug]
            );

            if (existing.rows.length > 0) {
                console.log(`⏭️  Service "${service.name}" already exists, skipping...`);
                continue;
            }

            // Insert new service
            await client.query(`
                INSERT INTO "Service" (id, name, slug, title, subtitle, description, icon, "isActive", "isFeatured", "order", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            `, [
                service.name,
                service.slug,
                service.title,
                service.subtitle,
                service.description,
                service.icon,
                service.isActive,
                service.isFeatured,
                service.order
            ]);

            console.log(`✅ Service "${service.name}" created successfully`);
        }

        // Display final count
        const result = await client.query(`SELECT COUNT(*) as count FROM "Service"`);
        console.log(`\n🎉 Total services in database: ${result.rows[0].count}`);

    } finally {
        client.release();
        await pool.end();
    }
}

seedServices()
    .catch(console.error);
