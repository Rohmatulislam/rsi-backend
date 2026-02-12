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
        const [tables] = await db.raw('SHOW TABLES LIKE "%piutang%"');
        console.log('Tables related to "piutang":');
        console.log(JSON.stringify(tables, null, 2));

        const [bayarTables] = await db.raw('SHOW TABLES LIKE "%bayar%"');
        console.log('\nTables related to "bayar":');
        console.log(JSON.stringify(bayarTables, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
