const { PrismaClient } = require('@prisma/client');
const { createPool } = require('mysql2/promise');
require('dotenv').config();

async function checkBuildings() {
    const pool = createPool({
        host: process.env.KHANZA_DB_HOST || 'localhost',
        port: parseInt(process.env.KHANZA_DB_PORT || '3306'),
        user: process.env.KHANZA_DB_USER || 'root',
        password: process.env.KHANZA_DB_PASSWORD || '',
        database: process.env.KHANZA_DB_NAME || 'sik',
    });

    try {
        console.log('--- BANGSAL (BUILDINGS) ---');
        const [bangsal] = await pool.query('SELECT kd_bangsal, nm_bangsal, status FROM bangsal');
        console.table(bangsal);

        console.log('\n--- KAMAR (BED AVAILABILITY) ---');
        const [kamar] = await pool.query(`
      SELECT 
        b.nm_bangsal, 
        k.kelas, 
        COUNT(k.kd_kamar) as total,
        SUM(CASE WHEN k.status = 'KOSONG' THEN 1 ELSE 0 END) as ketersediaan
      FROM kamar k
      JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      WHERE k.status != 'RUSAK'
      GROUP BY b.nm_bangsal, k.kelas
      ORDER BY b.nm_bangsal, k.kelas
    `);
        console.table(kamar);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkBuildings();
