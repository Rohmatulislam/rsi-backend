/**
 * Script untuk normalisasi nama poliklinik Eksekutif
 * Mengubah "Executive", "Ekskutif" menjadi "Eksekutif" (standar bahasa Indonesia)
 * Untuk mendukung fitur multi-language di masa depan
 */

require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function normalizeEksekutifNaming() {
    console.log('🔍 Mencari poliklinik dengan nama tidak standar...\n');

    const client = await pool.connect();

    try {
        // Find all items with "executive" or "ekskutif" (wrong spelling)
        const result = await client.query(`
            SELECT id, name FROM "ServiceItem" 
            WHERE LOWER(name) LIKE '%executive%' 
               OR LOWER(name) LIKE '%ekskutif%'
        `);

        if (result.rows.length === 0) {
            console.log('✅ Tidak ada poliklinik dengan nama yang perlu dinormalisasi.');
            console.log('   Semua nama sudah menggunakan format "Eksekutif".\n');

            // Show eksekutif items for verification
            const eksekItems = await client.query(`
                SELECT name FROM "ServiceItem" 
                WHERE LOWER(name) LIKE '%eksekutif%'
                ORDER BY name
            `);
            console.log(`📋 Daftar poliklinik Eksekutif (${eksekItems.rows.length} item):`);
            eksekItems.rows.forEach((row, idx) => {
                console.log(`   ${idx + 1}. ${row.name}`);
            });
            return;
        }

        console.log(`📋 Ditemukan ${result.rows.length} poliklinik yang perlu dinormalisasi:\n`);

        for (const item of result.rows) {
            const oldName = item.name;
            // Replace variations with "Eksekutif"
            const newName = oldName
                .replace(/Executive/gi, 'Eksekutif')
                .replace(/Ekskutif/gi, 'Eksekutif');

            console.log(`   "${oldName}"`);
            console.log(`   → "${newName}"\n`);

            // Update the name
            await client.query(
                `UPDATE "ServiceItem" SET name = $1 WHERE id = $2`,
                [newName, item.id]
            );
        }

        console.log(`\n✅ Berhasil memperbarui ${result.rows.length} nama poliklinik ke format "Eksekutif".`);
    } finally {
        client.release();
        await pool.end();
    }
}

normalizeEksekutifNaming()
    .catch(console.error);
