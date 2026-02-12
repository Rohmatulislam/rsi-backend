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
        console.time('query');
        const receivables = await db('piutang_pasien as p')
            .select(
                'p.no_rawat',
                'p.no_rkm_medis',
                'pas.nm_pasien',
                'p.tgl_piutang',
                'p.tgltempo',
                'p.totalpiutang as totalAmount',
                'p.sisapiutang as balance',
                'p.status',
                'dp.nama_bayar as penjab'
            )
            .join('pasien as pas', 'p.no_rkm_medis', 'pas.no_rkm_medis')
            .leftJoin('detail_piutang_pasien as dp', 'p.no_rawat', 'dp.no_rawat')
            .where('p.status', 'Belum Lunas')
            .andWhere('p.sisapiutang', '>', 0);
        console.timeEnd('query');

        console.log(`Query returned ${receivables.length} rows.`);

        // Explain plan
        const [explanation] = await db.raw(`
            EXPLAIN
            SELECT 
                p.no_rawat, p.no_rkm_medis, pas.nm_pasien, p.tgl_piutang, p.tgltempo, 
                p.totalpiutang as totalAmount, p.sisapiutang as balance, p.status, 
                dp.nama_bayar as penjab
            FROM piutang_pasien as p
            JOIN pasien as pas ON p.no_rkm_medis = pas.no_rkm_medis
            LEFT JOIN detail_piutang_pasien as dp ON p.no_rawat = dp.no_rawat
            WHERE p.status = 'Belum Lunas' AND p.sisapiutang > 0
        `);
        console.log('\nQuery Explanation:');
        console.log(JSON.stringify(explanation, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

main();
