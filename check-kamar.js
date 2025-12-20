const { Knex } = require('knex');
const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: process.env.KHANZA_DB_HOST || 'localhost',
        user: process.env.KHANZA_DB_USER || 'root',
        password: process.env.KHANZA_DB_PASSWORD || '',
        database: process.env.KHANZA_DB_NAME || 'sik',
        port: process.env.KHANZA_DB_PORT || 3306,
    },
});

async function findInpatientTables() {
    try {
        console.log('Searching for inpatient-related tables...');
        const tables = await knex.raw('SHOW TABLES');
        const tableList = tables[0].map(t => Object.values(t)[0]);

        const relatedTables = tableList.filter(t =>
            t.includes('kamar') || t.includes('bangsal') || t.includes('ranap') || t.includes('tarif_inap')
        );

        console.log('Related tables:', relatedTables);

        if (relatedTables.includes('kamar')) {
            console.log('\n--- KAMAR Table Schema ---');
            const kamarSchema = await knex.raw('DESCRIBE kamar');
            console.table(kamarSchema[0]);

            console.log('\n--- KAMAR Sample Data ---');
            const kamarData = await knex('kamar').limit(5);
            console.table(kamarData);
        }

        if (relatedTables.includes('bangsal')) {
            console.log('\n--- BANGSAL Table Schema ---');
            const bangsalSchema = await knex.raw('DESCRIBE bangsal');
            console.table(bangsalSchema[0]);

            console.log('\n--- BANGSAL Sample Data ---');
            const bangsalData = await knex('bangsal').limit(5);
            console.table(bangsalData);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await knex.destroy();
    }
}

findInpatientTables();
