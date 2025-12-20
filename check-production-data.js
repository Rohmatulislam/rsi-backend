/**
 * Check production data counts
 */
require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkData() {
    console.log('📊 Memeriksa data di production...\n');

    const client = await pool.connect();

    try {
        const tables = ['Doctor', 'Service', 'ServiceItem', 'DoctorSchedule'];

        for (const table of tables) {
            const result = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
            console.log(`${table}: ${result.rows[0].count} records`);
        }

        // Check services detail
        console.log('\n📋 Services:');
        const services = await client.query('SELECT name, slug FROM "Service" ORDER BY "order"');
        for (const s of services.rows) {
            const items = await client.query('SELECT COUNT(*) as count FROM "ServiceItem" WHERE "serviceId" = (SELECT id FROM "Service" WHERE slug = $1)', [s.slug]);
            console.log(`  - ${s.name} (${s.slug}): ${items.rows[0].count} items`);
        }

    } finally {
        client.release();
        await pool.end();
    }
}

checkData().catch(console.error);
