
const knex = require('knex');
require('dotenv').config();

async function main() {
    const db = knex({
        client: 'mysql2',
        connection: {
            host: process.env.KHANZA_DB_HOST,
            port: parseInt(process.env.KHANZA_DB_PORT),
            user: process.env.KHANZA_DB_USER,
            password: process.env.KHANZA_DB_PASSWORD,
            database: process.env.KHANZA_DB_NAME,
        },
    });

    try {
        console.log('Checking for duplicates AFTER filters (kd_pj=A09 & total_byr>0)...');
        const duplicates = await db('jns_perawatan_lab')
            .select('nm_perawatan')
            .count('nm_perawatan as count')
            .where('status', '1')
            .andWhere('kd_pj', 'A09')
            .andWhere('total_byr', '>', 0)
            .groupBy('nm_perawatan')
            .having('count', '>', 1);

        console.log('Duplicate names remaining:', duplicates.length);
        if (duplicates.length > 0) {
            console.log('Top 5 remaining duplicates:');
            console.log(JSON.stringify(duplicates.slice(0, 5), null, 2));

            const exampleName = duplicates[0].nm_perawatan;
            const details = await db('jns_perawatan_lab')
                .where('nm_perawatan', exampleName)
                .andWhere('kd_pj', 'A09')
                .andWhere('total_byr', '>', 0)
                .select('kd_jenis_prw', 'nm_perawatan', 'total_byr', 'kd_pj');
            console.log(`Details for "${exampleName}":`, details);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.destroy();
    }
}

main();
