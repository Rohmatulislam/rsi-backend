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
        const tables = ['bridging_sep', 'rvp_klaim_bpjs', 'skdp_bpjs'];
        for (const table of tables) {
            console.log(`\n--- Structure for ${table} ---`);
            try {
                const columns = await db.raw(`DESCRIBE ${table}`);
                console.log(JSON.stringify(columns[0], null, 2));

                // Get sample row
                const sample = await db(table).limit(1);
                console.log(`Sample row for ${table}:`, JSON.stringify(sample, null, 2));

                const count = await db(table).count('* as total');
                console.log(`Total rows in ${table}:`, count[0].total);
            } catch (e) {
                console.log(`Table ${table} not found or error.`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
