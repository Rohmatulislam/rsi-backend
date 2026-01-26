
import knex from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Starting standalone inspection script (Khanza only)...');

    // Knex for Khanza DB
    const khanzaDb = knex({
        client: 'mysql2',
        connection: {
            host: process.env.KHANZA_DB_HOST,
            port: Number(process.env.KHANZA_DB_PORT),
            user: process.env.KHANZA_DB_USER,
            password: process.env.KHANZA_DB_PASSWORD,
            database: process.env.KHANZA_DB_NAME,
        },
    });

    try {
        console.log('--- BANGSAL COUNT ---');
        const bangsalCount = await khanzaDb('bangsal').count('kd_bangsal as count');
        console.log(JSON.stringify(bangsalCount, null, 2));

        console.log('--- KAMAR COUNT ---');
        const kamarCount = await khanzaDb('kamar').count('kd_kamar as count');
        console.log(JSON.stringify(kamarCount, null, 2));

        console.log('--- ACTIVE BANGSAL (Room Units) ---');
        const activeBangsal = await khanzaDb('bangsal').where('status', '1').select('kd_bangsal', 'nm_bangsal');
        console.log(JSON.stringify(activeBangsal, null, 2));

        console.log('--- SAMPLE KAMAR DATA ---');
        const sampleKamar = await khanzaDb('kamar').select('*').limit(5);
        console.log(JSON.stringify(sampleKamar, null, 2));

        console.log('--- KAMAR STATUS SUMMARY ---');
        const statusSummary = await khanzaDb('kamar')
            .select('status')
            .count('status as count')
            .groupBy('status');
        console.log(JSON.stringify(statusSummary, null, 2));

    } catch (error) {
        console.error('Error during execution:', error);
    } finally {
        await khanzaDb.destroy();
    }
}

main();
