
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
        const totalTemplates = await db('template_laboratorium').count('id_template as total');
        console.log('Total template items:', totalTemplates[0].total);

        const testsWithPrice0 = await db('jns_perawatan_lab')
            .where('status', '1')
            .andWhere('kd_pj', 'A09')
            .andWhere('total_byr', 0)
            .count('kd_jenis_prw as total');
        console.log('Main tests with price 0:', testsWithPrice0[0].total);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.destroy();
    }
}

main();
