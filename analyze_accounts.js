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
        const [stats] = await knex.raw('SELECT tipe, LEFT(kd_rek, 1) as start_digit, COUNT(*) as count FROM rekening GROUP BY tipe, start_digit');
        console.log('\nAccount stats (tipe and first digit):');
        console.log(JSON.stringify(stats, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
}

run();
