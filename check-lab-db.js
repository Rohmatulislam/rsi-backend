
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
        console.log('Checking jns_perawatan_lab table...');
        const columns = await db('information_schema.columns')
            .where('table_name', 'jns_perawatan_lab')
            .andWhere('table_schema', process.env.KHANZA_DB_NAME)
            .select('column_name', 'data_type');

        console.log('Columns for jns_perawatan_lab:');
        console.log(JSON.stringify(columns, null, 2));

        if (columns.length === 0) {
            console.log('Searching for alternative tables like jns_perawatan_lab...');
            const tables = await db('information_schema.tables')
                .where('table_name', 'like', '%lab%')
                .andWhere('table_schema', process.env.KHANZA_DB_NAME)
                .select('table_name');
            console.log('Alternative lab tables found:', tables);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.destroy();
    }
}

main();
