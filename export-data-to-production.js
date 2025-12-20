/**
 * Export data lokal untuk import ke production
 * Jalankan: node export-data-to-production.js
 */

require('dotenv/config');
const { Pool } = require('pg');
const fs = require('fs');

// LOCAL database
const localPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rsidb',
});

async function exportData() {
    console.log('📤 Exporting data from local database...\n');

    const client = await localPool.connect();

    try {
        // Export ServiceItems
        const serviceItems = await client.query(`
            SELECT si.*, s.slug as service_slug 
            FROM "ServiceItem" si
            JOIN "Service" s ON si."serviceId" = s.id
        `);
        console.log(`ServiceItem: ${serviceItems.rows.length} records`);

        // Export DoctorSchedule
        let schedules = { rows: [] };
        try {
            schedules = await client.query('SELECT * FROM "DoctorSchedule"');
            console.log(`DoctorSchedule: ${schedules.rows.length} records`);
        } catch (e) {
            console.log('DoctorSchedule: Table not found');
        }

        // Save to JSON
        const exportData = {
            serviceItems: serviceItems.rows,
            doctorSchedules: schedules.rows,
            exportedAt: new Date().toISOString()
        };

        fs.writeFileSync('export-data.json', JSON.stringify(exportData, null, 2));
        console.log('\n✅ Data exported to export-data.json');

    } finally {
        client.release();
        await localPool.end();
    }
}

exportData().catch(console.error);
