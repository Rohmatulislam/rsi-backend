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
        const tablesToDescribe = ['detailjurnal'];

        for (const table of tablesToDescribe) {
            const [schema] = await knex.raw(`DESCRIBE ${table}`);
            console.log(`\nSchema for ${table}:`);
            console.log(JSON.stringify(schema, null, 2));
        }

        // Check some data to see how accounts are structured
        const [accounts] = await knex.raw('SELECT * FROM rekening LIMIT 10');
        console.log('\nSample accounts:');
        console.log(JSON.stringify(accounts, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
}

run();
