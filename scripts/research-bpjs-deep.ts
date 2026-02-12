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
        const patterns = ['%inacbg%', '%vclaim%', '%klaim%', '%inacbg%', '%coder%', '%bpjs%'];
        let allTables: string[] = [];

        for (const pattern of patterns) {
            const [rows] = await db.raw(`SHOW TABLES LIKE ?`, [pattern]);
            allTables = [...allTables, ...rows.map((r: any) => Object.values(r)[0])];
        }

        const uniqueTables = Array.from(new Set(allTables)).sort();
        console.log('Relevant Tables Found:');
        console.log(JSON.stringify(uniqueTables, null, 2));

        // Let's also look for tables related to "reg_periksa" and its links to BPJS
        const importantTables = [
            'inacbg_get_tgl_sep',
            'inacbg_klaim_baru',
            'inacbg_klaim_rahasia',
            'bridging_sep',
            'bridging_monitoring_klaim_jasaraharja',
            'bridging_monitoring_klaim_history',
            'kodifikasi_penyakit_bpjs',
            'piutang_pasien'
        ];

        for (const table of importantTables) {
            try {
                const columns = await db.raw(`DESCRIBE ${table}`);
                console.log(`\n--- Schema for ${table} ---`);
                console.log(JSON.stringify(columns[0], null, 2));
                const sample = await db(table).limit(1);
                console.log(`Sample row for ${table}:`, JSON.stringify(sample, null, 2));
            } catch (e) {
                // skip if not found
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
