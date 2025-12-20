/**
 * Import data ke production dari export-data.json
 * Jalankan dengan: 
 * $env:DATABASE_URL = "postgresql://...production..."; node import-data-to-production.js
 */

require('dotenv/config');
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function importData() {
    console.log('📥 Importing data to production database...\n');

    if (!fs.existsSync('export-data.json')) {
        console.error('❌ export-data.json tidak ditemukan! Jalankan export dulu.');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync('export-data.json', 'utf8'));
    console.log(`Exported at: ${data.exportedAt}`);
    console.log(`ServiceItems to import: ${data.serviceItems.length}`);
    console.log(`DoctorSchedules to import: ${data.doctorSchedules.length}\n`);

    const client = await pool.connect();

    try {
        // Get services mapping from production
        const services = await client.query('SELECT id, slug FROM "Service"');
        const serviceMap = {};
        services.rows.forEach(s => serviceMap[s.slug] = s.id);

        // Import ServiceItems
        let importedItems = 0;
        let skippedItems = 0;

        for (const item of data.serviceItems) {
            const serviceId = serviceMap[item.service_slug];
            if (!serviceId) {
                console.log(`⏭️ Skip: Service ${item.service_slug} not found`);
                skippedItems++;
                continue;
            }

            // Check if already exists
            const existing = await client.query(
                'SELECT id FROM "ServiceItem" WHERE id = $1',
                [item.id]
            );

            if (existing.rows.length > 0) {
                skippedItems++;
                continue;
            }

            await client.query(`
                INSERT INTO "ServiceItem" (id, "serviceId", category, name, description, price, features, icon, "imageUrl", "isActive", "order", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO NOTHING
            `, [
                item.id,
                serviceId,
                item.category,
                item.name,
                item.description,
                item.price,
                item.features,
                item.icon,
                item.imageUrl,
                item.isActive,
                item.order,
                item.createdAt,
                item.updatedAt
            ]);
            importedItems++;
        }

        console.log(`✅ ServiceItems imported: ${importedItems}, skipped: ${skippedItems}`);

        // Import DoctorSchedules
        let importedSchedules = 0;
        let skippedSchedules = 0;

        for (const schedule of data.doctorSchedules) {
            const existing = await client.query(
                'SELECT id FROM "DoctorSchedule" WHERE id = $1',
                [schedule.id]
            );

            if (existing.rows.length > 0) {
                skippedSchedules++;
                continue;
            }

            try {
                await client.query(`
                    INSERT INTO "DoctorSchedule" (id, "doctorId", "dayOfWeek", "startTime", "endTime", "isActive", "createdAt", "updatedAt")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    schedule.id,
                    schedule.doctorId,
                    schedule.dayOfWeek,
                    schedule.startTime,
                    schedule.endTime,
                    schedule.isActive,
                    schedule.createdAt,
                    schedule.updatedAt
                ]);
                importedSchedules++;
            } catch (e) {
                console.log(`⚠️ Schedule error: ${e.message}`);
            }
        }

        console.log(`✅ DoctorSchedules imported: ${importedSchedules}, skipped: ${skippedSchedules}`);

        console.log('\n🎉 Import selesai!');

    } finally {
        client.release();
        await pool.end();
    }
}

importData().catch(console.error);
