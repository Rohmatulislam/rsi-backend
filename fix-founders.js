/**
 * Script untuk memperbaiki URL Founder agar sesuai dengan file yang ada di Supabase
 */

require('dotenv/config');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function fixFoundersByMatchingId() {
    console.log('🔧 Memperbaiki URL Founder dengan mencocokkan ID...\n');

    const client = await pool.connect();

    try {
        // List files di bucket founders
        const { data: files, error } = await supabase.storage
            .from('founders')
            .list('', { limit: 100 });

        if (error) {
            console.error('Error listing files:', error);
            return;
        }

        console.log(`📁 Files di Supabase bucket 'founders': ${files.length}\n`);

        // Get founders from database
        const result = await client.query('SELECT id, name, image FROM "Founder"');

        for (const founder of result.rows) {
            console.log(`\n🔍 ${founder.name} (ID: ${founder.id})`);

            // Find matching file by founder ID
            const matchingFile = files.find(f => f.name.includes(founder.id));

            if (matchingFile) {
                const newUrl = `https://vpncigkytgwjlhqzvcbt.supabase.co/storage/v1/object/public/founders/${matchingFile.name}`;

                await client.query(
                    'UPDATE "Founder" SET image = $1 WHERE id = $2',
                    [newUrl, founder.id]
                );

                console.log(`   ✅ Updated to: ${matchingFile.name}`);
            } else {
                console.log(`   ❌ No matching file found in Supabase`);
            }
        }

        console.log('\n🎉 Selesai!');
    } finally {
        client.release();
        await pool.end();
    }
}

fixFoundersByMatchingId().catch(console.error);
