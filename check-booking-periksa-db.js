
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
        console.log('Checking booking_periksa table...');
        const columns = await db('information_schema.columns')
            .where('table_name', 'booking_periksa')
            .andWhere('table_schema', process.env.KHANZA_DB_NAME)
            .select('column_name', 'data_type');

        console.log('Columns for booking_periksa:');
        console.log(JSON.stringify(columns, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.destroy();
    }
}

main();
