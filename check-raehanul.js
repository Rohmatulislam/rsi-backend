const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.KHANZA_DB_HOST,
            user: process.env.KHANZA_DB_USER,
            password: process.env.KHANZA_DB_PASSWORD,
            database: process.env.KHANZA_DB_NAME,
            port: process.env.KHANZA_DB_PORT || 3306
        });

        const [schedules] = await connection.execute(`
            SELECT j.kd_poli, p.nm_poli, j.hari_kerja, j.jam_mulai, j.jam_selesai
            FROM jadwal j
            JOIN poliklinik p ON j.kd_poli = p.kd_poli
            WHERE j.kd_dokter = 'D0000055'
        `);
        console.log('Schedules for D0000055:', schedules);

        await connection.end();
    } catch (e) {
        console.error(e);
    }
}

run();
