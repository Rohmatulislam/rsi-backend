import { knex } from 'knex';
import 'dotenv/config';

async function main() {
    const db = knex({
        client: 'mysql2',
        connection: { host: process.env.KHANZA_DB_HOST, port: Number(process.env.KHANZA_DB_PORT), user: process.env.KHANZA_DB_USER, password: process.env.KHANZA_DB_PASSWORD, database: process.env.KHANZA_DB_NAME },
    });

    try {
        const [rows] = await db.raw('SHOW TABLES');
        const tables = rows.map((r: any) => Object.values(r)[0]);

        const filterTables = (keyword: string) => tables.filter((t: string) => t.toLowerCase().includes(keyword.toLowerCase()));

        console.log('--- BPJS Tables ---');
        console.log(filterTables('bpjs'));

        console.log('\n--- INA-CBG Tables ---');
        console.log(filterTables('inacbg'));

        console.log('\n--- SEP Tables ---');
        console.log(filterTables('sep'));

        console.log('\n--- Claim/Klaim Tables ---');
        console.log(filterTables('klaim'));

        const schemasToInspect = [
            'bridging_sep',
            'rvp_klaim_bpjs',
            'bpjs_monitoring_klaim',
            'inacbg_klaim_baru',
            'inacbg_hambatan',
            'bridging_eklaim_vclaim_monitoring_klaim'
        ];

        for (const table of schemasToInspect) {
            if (tables.includes(table)) {
                const cols = await db.raw(`DESCRIBE ${table}`);
                console.log(`\n=== Schema: ${table} ===`);
                console.log(JSON.stringify(cols[0], null, 2));
                const sample = await db(table).limit(1);
                console.log(`Sample row for ${table}:`, JSON.stringify(sample, null, 2));
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
