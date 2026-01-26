
import knex from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Simulating getBedAvailability logic...');

    // Knex for Khanza DB
    const db = knex({
        client: 'mysql2',
        connection: {
            host: process.env.KHANZA_DB_HOST,
            port: Number(process.env.KHANZA_DB_PORT),
            user: process.env.KHANZA_DB_USER,
            password: process.env.KHANZA_DB_PASSWORD,
            database: process.env.KHANZA_DB_NAME,
        },
    });

    try {
        const beds = await db('kamar')
            .join('bangsal', 'kamar.kd_bangsal', 'bangsal.kd_bangsal')
            .select(
                'bangsal.kd_bangsal',
                'bangsal.nm_bangsal',
                'kamar.kelas',
                db.raw('count(kamar.kd_kamar) as total'),
                db.raw("sum(case when kamar.status = 'KOSONG' then 1 else 0 end) as available"),
                db.raw("min(kamar.trf_kamar) as min_price"),
                db.raw("max(kamar.trf_kamar) as max_price")
            )
            .where('kamar.status', '!=', 'RUSAK') // Abaikan bed rusak
            .andWhere('bangsal.status', '1') // Bangsal aktif
            .groupBy('bangsal.kd_bangsal', 'bangsal.nm_bangsal', 'kamar.kelas')
            .orderBy('bangsal.nm_bangsal', 'asc');

        console.log('--- BED AVAILABILITY RESULTS ---');
        console.log(JSON.stringify(beds, null, 2));

    } catch (error) {
        console.error('Error during execution:', error);
    } finally {
        await db.destroy();
    }
}

main();
