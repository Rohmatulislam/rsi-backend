import { knex } from 'knex';
import 'dotenv/config';

async function main() {
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
        const countRes = await db('bridging_sep').count('* as total');
        console.log(`Total rows in bridging_sep:`, countRes[0].total);

        if (Number(countRes[0].total) > 0) {
            const samples = await db('bridging_sep').limit(3);
            console.log(`Samples from bridging_sep:`, JSON.stringify(samples, null, 2));

            const byMonth = await db('bridging_sep')
                .select(db.raw('DATE_FORMAT(tglsep, "%Y-%m") as month'))
                .count('* as count')
                .groupBy('month')
                .orderBy('month', 'desc')
                .limit(6);
            console.log(`BPJS SEP Trends (Last 6 months):`, JSON.stringify(byMonth, null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
