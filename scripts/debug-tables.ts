import { Knex, knex } from 'knex';
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
        console.log("Checking columns for databarang...");
        const columns = await db.raw("DESCRIBE databarang");
        console.log(JSON.stringify(columns[0], null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
