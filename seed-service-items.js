/**
 * Script untuk seeding ServiceItems (Rawat Jalan & Poli Eksekutif)
 * Mengambil data dari Khanza untuk Rawat Jalan.
 * Menggunakan data statis/custom untuk Poli Eksekutif.
 * 
 * Jalankan: node seed-service-items.js
 */

require('dotenv/config');
const { Pool } = require('pg');
const knex = require('knex');

// Konfigurasi Postgres (App DB)
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Konfigurasi MySQL (Khanza DB)
const khanzaConfig = {
    host: '192.168.10.2', // Direct LAN connection
    port: 3306,
    user: process.env.KHANZA_DB_USER || 'sitihajar',
    password: process.env.KHANZA_DB_PASSWORD || 'timit007',
    database: process.env.KHANZA_DB_NAME || 'sik_rsi',
    connectTimeout: 60000,
};

const khanzaDb = knex({
    client: 'mysql2',
    connection: khanzaConfig
});

async function seedServiceItems() {
    console.log('🌱 Seeding ServiceItems (Real Data from SIMRS)...\n');

    const client = await pgPool.connect();

    try {
        // 1. Get Service IDs
        console.log('🔍 Finding Service IDs...');
        const services = await client.query('SELECT id, slug FROM "Service" WHERE slug IN ($1, $2)', ['rawat-jalan', 'poli-executive']);

        const rawatJalan = services.rows.find(s => s.slug === 'rawat-jalan');
        const poliExecutive = services.rows.find(s => s.slug === 'poli-executive');

        if (!rawatJalan) console.log('⚠️ Service "Rawat Jalan" not found! Run seed-services.js first.');
        if (!poliExecutive) console.log('⚠️ Service "Poli Eksekutif" not found! Run seed-services.js first.');

        if (poliExecutive) {
            console.log('\n🗑️  Cleaning up existing Poli Eksekutif items...');
            await client.query('DELETE FROM "ServiceItem" WHERE "serviceId" = $1', [poliExecutive.id]);
        }

        // 2. Seed Rawat Jalan (from Khanza)
        if (rawatJalan) {
            console.log('\n🏥 Fetching Poliklinik (Rawat Jalan) from Khanza...');
            try {
                // Ambil semua poli aktif
                const allPolis = await khanzaDb('poliklinik')
                    .select('kd_poli', 'nm_poli')
                    .where('status', '1');

                // Filter untuk Rawat Jalan (exclude Eksekutif/Ekskutif, UGD)
                const rawatJalanPolis = allPolis.filter(p =>
                    !p.nm_poli.toLowerCase().includes('eksekutif') &&
                    !p.nm_poli.toLowerCase().includes('ekskutif') && // Typo handling
                    !p.nm_poli.toLowerCase().includes('vip') &&
                    !p.nm_poli.includes('IGD') &&
                    !p.nm_poli.includes('UGD')
                );

                console.log(`   Found ${rawatJalanPolis.length} regular polikliniks.`);

                let count = 0;
                for (const poli of rawatJalanPolis) {
                    const itemName = poli.nm_poli;
                    const itemDesc = `Layanan spesialis ${poli.nm_poli} dengan dokter berpengalaman.`;

                    await client.query(`
                        INSERT INTO "ServiceItem" (id, "serviceId", category, name, description, icon, "isActive", "order", "createdAt", "updatedAt")
                        VALUES (gen_random_uuid(), $1, 'POLIKLINIK', $2, $3, 'Stethoscope', true, $4, NOW(), NOW())
                        ON CONFLICT DO NOTHING
                    `, [rawatJalan.id, itemName, itemDesc, count++]);
                }
                console.log(`   ✅ Seeded ${count} items for Rawat Jalan`);

                // 3. Seed Poli Eksekutif (from Khanza)
                if (poliExecutive) {
                    console.log('\n👑 Fetching Poli Eksekutif from Khanza...');
                    const executivePolis = allPolis.filter(p =>
                        p.nm_poli.toLowerCase().includes('eksekutif') ||
                        p.nm_poli.toLowerCase().includes('ekskutif') || // Typo handling
                        p.nm_poli.toLowerCase().includes('vip') ||
                        p.nm_poli.toLowerCase().includes('executive')
                    );

                    console.log(`   Found ${executivePolis.length} executive clinics.`);

                    let execCount = 0;
                    for (const poli of executivePolis) {
                        const itemName = poli.nm_poli;
                        // Rapikan nama jika typo
                        const displayName = itemName.replace('Ekskutif', 'Eksekutif');
                        const itemDesc = `Layanan premium ${displayName} dengan fasilitas eksklusif.`;

                        await client.query(`
                            INSERT INTO "ServiceItem" (id, "serviceId", category, name, description, icon, "isActive", "order", "createdAt", "updatedAt")
                            VALUES (gen_random_uuid(), $1, 'EXECUTIVE', $2, $3, 'Crown', true, $4, NOW(), NOW())
                            ON CONFLICT DO NOTHING
                        `, [poliExecutive.id, displayName, itemDesc, execCount++]);
                    }
                    console.log(`   ✅ Seeded ${execCount} items for Poli Eksekutif`);
                }

            } catch (err) {
                console.error('   ❌ Error fetching from Khanza:', err.message);
            }
        }

    } finally {
        client.release();
        await pgPool.end();
        await khanzaDb.destroy();
    }
}

seedServiceItems().catch(console.error);
