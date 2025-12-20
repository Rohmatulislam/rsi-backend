const { Knex } = require('knex');
require('dotenv').config();

const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: process.env.KHANZA_DB_HOST || 'localhost',
        user: process.env.KHANZA_DB_USER || 'root',
        password: process.env.KHANZA_DB_PASSWORD || '',
        database: process.env.KHANZA_DB_NAME || 'sik',
        port: process.env.KHANZA_DB_PORT || 3306,
    },
});

async function run() {
    try {
        console.log('Fetching Bed Availability from Khanza...');
        const beds = await knex('kamar')
            .join('bangsal', 'kamar.kd_bangsal', 'bangsal.kd_bangsal')
            .select(
                'bangsal.kd_bangsal',
                'bangsal.nm_bangsal',
                'kamar.kelas',
                knex.raw('count(kamar.kd_kamar) as total'),
                knex.raw("sum(case when kamar.status = 'KOSONG' then 1 else 0 end) as available")
            )
            .where('kamar.status', '!=', 'RUSAK')
            .andWhere('bangsal.status', '1')
            .groupBy('bangsal.kd_bangsal', 'bangsal.nm_bangsal', 'kamar.kelas')
            .orderBy('bangsal.nm_bangsal', 'asc');

        console.table(beds);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await knex.destroy();
    }
}

run();
