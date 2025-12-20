
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
        console.log('Checking template_laboratorium table structure...');
        const columns = await db('information_schema.columns')
            .where('table_name', 'template_laboratorium')
            .andWhere('table_schema', process.env.KHANZA_DB_NAME)
            .select('column_name', 'data_type');

        console.log('Columns for template_laboratorium:');
        console.log(JSON.stringify(columns, null, 2));

        console.log('\nFetching some sample records linked to a lab test...');
        // J000001 is often a common code like Hematologi in some Khanza installations
        const samples = await db('template_laboratorium')
            .limit(10);
        console.log('Sample data:');
        console.log(JSON.stringify(samples, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.destroy();
    }
}

main();
