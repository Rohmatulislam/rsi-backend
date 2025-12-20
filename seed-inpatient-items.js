/**
 * Script untuk seeding ServiceItems (Rawat Inap)
 * Mengambil data Bangsal dari Khanza dan memasukkannya sebagai ServiceItems.
 * 
 * Jalankan: node seed-inpatient-items.js
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
    user: process.env.KHANZA_DB_USER || 'sitihajar', // Fallback to proven creds
    password: process.env.KHANZA_DB_PASSWORD || 'timit007',
    database: process.env.KHANZA_DB_NAME || 'sik_rsi',
    connectTimeout: 60000,
};

const khanzaDb = knex({
    client: 'mysql2',
    connection: khanzaConfig
});

async function seedInpatientItems() {
    console.log('🌱 Seeding ServiceItems (Rawat Inap from SIMRS)...\n');

    const client = await pgPool.connect();

    try {
        // 1. Get Service ID for Rawat Inap
        console.log('🔍 Finding Service ID...');
        const service = await client.query('SELECT id, slug FROM "Service" WHERE slug = $1', ['rawat-inap']);

        if (service.rows.length === 0) {
            console.log('⚠️ Service "Rawat Inap" not found! Run seed-services.js first.');
            return;
        }

        const rawatInapId = service.rows[0].id;
        console.log(`   Found Rawat Inap ID: ${rawatInapId}`);

        // 2. Fetch Distinct Classes per Building from Khanza
        console.log('\n🏥 Fetching Building & Class combinations from Khanza...');

        try {
            // Get all rooms to derive available classes per building
            // Join bangsal to get the name
            const roomClasses = await khanzaDb('kamar as k')
                .join('bangsal as b', 'k.kd_bangsal', 'b.kd_bangsal')
                .distinct('b.nm_bangsal', 'k.kelas')
                .where('b.status', '1')
                .where('k.statusdata', '1')
                .orderBy(['b.nm_bangsal', 'k.kelas']);

            console.log(`   Found ${roomClasses.length} building-class combinations.`);

            // 3. Insert into ServiceItem
            let count = 0;
            // Clear existing items for this service
            await client.query('DELETE FROM "ServiceItem" WHERE "serviceId" = $1', [rawatInapId]);
            console.log('   Cleared existing items.');

            for (const rc of roomClasses) {
                const buildingName = rc.nm_bangsal;
                const className = rc.kelas;

                // Frontend logic: 
                // Group by Category -> So Category must be Building Name
                // Item Name -> Class Name
                const category = buildingName;
                const itemName = className;
                const itemDesc = `Layanan rawat inap ${className} di ${buildingName}.`;

                await client.query(`
                    INSERT INTO "ServiceItem" (id, "serviceId", category, name, description, icon, "isActive", "order", "createdAt", "updatedAt")
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Building2', true, $5, NOW(), NOW())
                `, [rawatInapId, category, itemName, itemDesc, count++]);
            }
            console.log(`   ✅ Seeded ${count} items for Rawat Inap`);

        } catch (err) {
            console.error('   ❌ Error fetching from Khanza:', err.message);
        }

    } finally {
        client.release();
        await pgPool.end();
        await khanzaDb.destroy();
    }
}

seedInpatientItems().catch(console.error);
