const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
require('dotenv').config();

// We need Khanza DB too, which is MySQL
async function run() {
    // Note: I don't have direct access to Khanza credentials in .env easily without reading it
    // But I can try to use the backend's approach if I know the env vars
    console.log('KHANZA_DB_HOST:', process.env.KHANZA_DB_HOST);

    try {
        const connection = await mysql.createConnection({
            host: process.env.KHANZA_DB_HOST,
            user: process.env.KHANZA_DB_USER,
            password: process.env.KHANZA_DB_PASSWORD,
            database: process.env.KHANZA_DB_NAME,
            port: process.env.KHANZA_DB_PORT || 3306
        });

        const [polis] = await connection.execute('SELECT kd_poli, nm_poli FROM poliklinik WHERE nm_poli LIKE "%Lab%" OR nm_poli LIKE "%Rad%"');
        console.log('Polis found:', polis);

        if (polis.length > 0) {
            const poliCodes = polis.map(p => `'${p.kd_poli}'`).join(',');
            const [schedules] = await connection.execute(`
                SELECT j.kd_dokter, d.nm_dokter, j.kd_poli, p.nm_poli, j.hari_kerja, j.jam_mulai, j.jam_selesai
                FROM jadwal j
                JOIN dokter d ON j.kd_dokter = d.kd_dokter
                JOIN poliklinik p ON j.kd_poli = p.kd_poli
                WHERE j.kd_poli IN (${poliCodes})
                AND j.jam_mulai != "00:00:00"
            `);
            console.log('Schedules found:', schedules);
        }

        await connection.end();
    } catch (e) {
        console.error('Error connecting to Khanza:', e.message);
    }
}

run();
