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
        console.log("Listing tables...");
        const [rows] = await db.raw("SHOW TABLES");
        const tables = rows.map((row: any) => Object.values(row)[0]);

        const filtered = tables.filter((t: string) =>
            t.includes('beli') ||
            t.includes('hutang') ||
            t.includes('piutang') ||
            t.includes('bayar')
        );

        console.log("Found tables related to finance/purchasing:");
        console.log(filtered.join(', '));

    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
