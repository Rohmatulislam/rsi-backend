import { knex } from 'knex';
import 'dotenv/config';

async function main() {
    const db = knex({
        client: 'mysql2',
        connection: { host: process.env.KHANZA_DB_HOST, port: Number(process.env.KHANZA_DB_PORT), user: process.env.KHANZA_DB_USER, password: process.env.KHANZA_DB_PASSWORD, database: process.env.KHANZA_DB_NAME },
    });

    try {
        const potentialTables = [
            'bpjs_monitoring_klaim',
            'bridging_eklaim_vclaim_monitoring_klaim',
            'inacbg_hasil_konfirmasi',
            'inacbg_respon_tarif'
        ];

        for (const table of potentialTables) {
            try {
                const countRes = await db(table).count('* as total');
                console.log(`\nTable: ${table} | Total rows: ${countRes[0].total}`);
                if (Number(countRes[0].total) > 0) {
                    const sample = await db(table).limit(1);
                    console.log(`Sample:`, JSON.stringify(sample[0], null, 2));
                }
            } catch (e) {
                console.log(`Table ${table} not found or inaccessible.`);
            }
        }

        // Researching linkage between billing (piutang) and SEP
        console.log('\n--- Linkage Research: reg_periksa <-> bridging_sep ---');
        const linkageSample = await db('reg_periksa as r')
            .join('bridging_sep as s', 'r.no_rawat', 's.no_rawat')
            .select('r.no_rawat', 'r.no_rkm_medis', 's.no_sep', 'r.tgl_registrasi')
            .limit(3);
        console.log('Sample registration-SEP linkage:', JSON.stringify(linkageSample, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
