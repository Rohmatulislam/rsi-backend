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
        const [tables] = await db.raw('SHOW TABLES LIKE "%bpjs%"');
        console.log('Tables related to "bpjs":');
        console.log(JSON.stringify(tables, null, 2));

        const [sepTables] = await db.raw('SHOW TABLES LIKE "%sep%"');
        console.log('\nTables related to "sep":');
        console.log(JSON.stringify(sepTables, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
