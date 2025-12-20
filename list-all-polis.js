require('dotenv').config();

const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: process.env.KHANZA_DB_HOST || '192.168.10.2',
        user: process.env.KHANZA_DB_USER || 'remote',
        password: process.env.KHANZA_DB_PASSWORD || 'secret',
        database: process.env.KHANZA_DB_NAME || 'sik',
        port: 3306
    }
});

async function listAllPolis() {
    try {
        console.log('Listing all polis...');
        const polis = await knex('poliklinik')
            .select('kd_poli', 'nm_poli');

        console.log('Polis found:', polis);
    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
}

listAllPolis();
