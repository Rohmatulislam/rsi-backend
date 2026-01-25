const knex = require('knex');
require('dotenv').config();

async function check() {
    const db = knex({
        client: 'mysql2',
        connection: {
            host: process.env.KHANZA_DB_HOST,
            port: process.env.KHANZA_DB_PORT,
            user: process.env.KHANZA_DB_USER,
            password: process.env.KHANZA_DB_PASSWORD,
            database: process.env.KHANZA_DB_NAME,
        }
    });

    try {
        console.log('--- Poliklinik with Schedules (via join in code) ---');
        const activePoli = await db('jadwal')
            .select('poliklinik.kd_poli', 'poliklinik.nm_poli')
            .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
            .distinct();
        console.log(JSON.stringify(activePoli.slice(0, 20), null, 2));

        console.log('\n--- Count schedules for each poli ---');
        const counts = await db('jadwal')
            .select('kd_poli')
            .count('* as count')
            .groupBy('kd_poli');
        console.log(counts);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await db.destroy();
    }
}

check();
