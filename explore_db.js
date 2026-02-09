const Knex = require('knex');
const knex = Knex({
    client: 'mysql2',
    connection: {
        host: '192.168.10.159',
        user: 'sitihajar',
        password: 'timit007',
        database: 'sik_rsi',
        port: 3306
    }
});

async function run() {
    try {
        const [tables] = await knex.raw('SHOW TABLES');
        console.log('Tables found:');
        const tableList = tables.map(t => Object.values(t)[0]);

        const accountingTables = tableList.filter(t =>
            t.includes('jurnal') ||
            t.includes('rekening') ||
            t.includes('pengeluaran') ||
            t.includes('penerimaan') ||
            t.includes('saldo') ||
            t.includes('akun') ||
            t.includes('pembukuan') ||
            t.includes('neraca') ||
            t.includes('labarugi') ||
            t.includes('modal')
        );

        console.log(JSON.stringify(accountingTables, null, 2));

        // Sample schema for important tables
        const tablesToDescribe = ['jurnal', 'detail_jurnal', 'rekening', 'kategori_perkiraan', 'pembukuan'];

        for (const table of tablesToDescribe) {
            if (accountingTables.includes(table)) {
                const [schema] = await knex.raw(`DESCRIBE ${table}`);
                console.log(`\nSchema for ${table}:`);
                console.log(JSON.stringify(schema, null, 2));
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
}

run();
