const { Knex } = require('knex');
const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: process.env.KHANZA_DB_HOST || '192.168.10.2',
        user: process.env.KHANZA_DB_USER || 'sitihajar', // Fallback to proven creds
        password: process.env.KHANZA_DB_PASSWORD || 'timit007',
        database: process.env.KHANZA_DB_NAME || 'sik_rsi',
        port: process.env.KHANZA_DB_PORT || 3306,
        connectTimeout: 60000,
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

        if (relatedTables.includes('kamar') && relatedTables.includes('bangsal')) {
            console.log('\n--- ANALISIS GAMBARAN GEDUNG VS KAMAR ---');

            // 1. Ambil semua bangsal aktif
            const allBangsal = await knex('bangsal').select('kd_bangsal', 'nm_bangsal').where('status', '1');
            console.log(`Total Bangsal Aktif: ${allBangsal.length}`);

            // 2. Ambil bangsal yang dipakai di tabel kamar
            const usedBangsalCodes = await knex('kamar').distinct('kd_bangsal').pluck('kd_bangsal');
            console.log(`Total Bangsal Punya Kamar: ${usedBangsalCodes.length}`);

            // 3. Bangsal yang TIDAK punya kamar (Kemungkinan Gudang/Kantor)
            const unusedBangsal = allBangsal.filter(b => !usedBangsalCodes.includes(b.kd_bangsal));

            console.log('\n--- Bangsal TANPA Kamar (Akan Dihapus jika difilter) ---');
            console.table(unusedBangsal.slice(0, 20)); // Show samples

            console.log(`\nJumlah Bangsal Non-Perawatan: ${unusedBangsal.length}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await knex.destroy();
    }
}

findInpatientTables();
