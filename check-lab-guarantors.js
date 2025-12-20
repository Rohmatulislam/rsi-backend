
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
        console.log('Fetching active guarantors for lab tests...');
        const result = await db('jns_perawatan_lab')
            .distinct('jns_perawatan_lab.kd_pj')
            .join('penjab', 'jns_perawatan_lab.kd_pj', 'penjab.kd_pj')
            .select('penjab.kd_pj as id', 'penjab.png_jawab as name')
            .where('jns_perawatan_lab.status', '1');

        console.log('Active guarantors:');
        console.log(JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.destroy();
    }
}

main();
