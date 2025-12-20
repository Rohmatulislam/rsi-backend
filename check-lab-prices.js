
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
        console.log('Comparing prices between jns_perawatan_lab and template_laboratorium...');
        const tests = await db('jns_perawatan_lab')
            .where('status', '1')
            .andWhere('kd_pj', 'A09')
            .select('kd_jenis_prw', 'nm_perawatan', 'total_byr')
            .limit(10);

        for (const test of tests) {
            const templates = await db('template_laboratorium')
                .where('kd_jenis_prw', test.kd_jenis_prw)
                .select('Pemeriksaan', 'biaya_item');

            const totalTemplatePrice = templates.reduce((sum, t) => sum + (t.biaya_item || 0), 0);

            console.log(`\nTest: ${test.nm_perawatan} (${test.kd_jenis_prw})`);
            console.log(`Main Price: ${test.total_byr}`);
            console.log(`Template Item Count: ${templates.length}`);
            console.log(`Sum of Template biayas: ${totalTemplatePrice}`);
            if (templates.length > 0) {
                console.log('Sample templates:', templates.slice(0, 3));
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.destroy();
    }
}

main();
