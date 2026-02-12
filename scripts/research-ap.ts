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
        const tables = ['pembelian', 'piutang_dapet', 'bayar_piutang_dapet', 'ipsrspembelian', 'ipsrspiutang'];
        for (const table of tables) {
            console.log(`\n--- Structure for ${table} ---`);
            try {
                const columns = await db.raw(`DESCRIBE ${table}`);
                console.log(JSON.stringify(columns[0], null, 2));
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
