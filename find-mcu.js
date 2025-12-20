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

async function findMcuPolis() {
    try {
        console.log('Searching for MCU related polis...');
        const polis = await knex('poliklinik')
            .where('nm_poli', 'like', '%MCU%')
            .orWhere('nm_poli', 'like', '%Check%')
            .orWhere('nm_poli', 'like', '%Surat%')
            .orWhere('nm_poli', 'like', '%Sehat%')
            .select('kd_poli', 'nm_poli');

        console.log('Polis found:', polis);

        if (polis.length > 0) {
            const kd_polis = polis.map(p => p.kd_poli);
            const schedules = await knex('jadwal')
                .join('dokter', 'jadwal.kd_dokter', 'dokter.kd_dokter')
                .join('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
                .whereIn('jadwal.kd_poli', kd_polis)
                .select(
                    'jadwal.kd_dokter',
                    'dokter.nm_dokter',
                    'jadwal.kd_poli',
                    'poliklinik.nm_poli',
                    'jadwal.hari_kerja',
                    'jadwal.jam_mulai',
                    'jadwal.jam_selesai'
                );
            console.log('Schedules found:', schedules);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
}

findMcuPolis();
