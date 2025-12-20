/**
 * Script Migrasi Gambar ke Supabase Storage
 * 
 * Script ini akan:
 * 1. Membaca semua gambar dari folder uploads/
 * 2. Upload ke Supabase Storage
 * 3. Update URL di database
 * 
 * Jalankan: node migrate-images-to-supabase.js
 */

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ===========================================================================
// Configuration
// ===========================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL dan SUPABASE_SERVICE_KEY harus diset di .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const pool = new Pool({ connectionString: DATABASE_URL });

// Mapping folder lokal ke bucket dan tabel database
const MIGRATIONS = [
    {
        localFolder: 'uploads',
        bucket: 'doctors',
        table: 'Doctor',
        urlColumn: 'imageUrl',  // Fixed: was 'image'
        urlPattern: /\/uploads\/doctor-/
    },
    {
        localFolder: 'uploads/founders',
        bucket: 'founders',
        table: 'Founder',
        urlColumn: 'image',
        urlPattern: /\/uploads\/founders\//
    },
    {
        localFolder: 'uploads/articles',
        bucket: 'articles',
        table: 'Article',
        urlColumn: 'image',
        urlPattern: /\/uploads\/articles\//
    }
];

// ===========================================================================
// Helper Functions
// ===========================================================================

function getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return types[ext] || 'image/jpeg';
}

async function uploadToSupabase(bucket, fileName, filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = getMimeType(fileName);

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, fileBuffer, {
            contentType,
            upsert: true
        });

    if (error) {
        throw error;
    }

    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

async function updateDatabaseUrls(client, table, urlColumn, oldUrl, newUrl) {
    await client.query(
        `UPDATE "${table}" SET "${urlColumn}" = $1 WHERE "${urlColumn}" LIKE $2`,
        [newUrl, `%${path.basename(oldUrl)}%`]
    );
}

// ===========================================================================
// Main Migration
// ===========================================================================

async function migrateImages() {
    console.log('🚀 Memulai migrasi gambar ke Supabase Storage...\n');

    const client = await pool.connect();
    const results = { uploaded: 0, failed: 0, skipped: 0 };

    try {
        for (const migration of MIGRATIONS) {
            const folderPath = path.join(process.cwd(), migration.localFolder);

            if (!fs.existsSync(folderPath)) {
                console.log(`⏭️  Folder ${migration.localFolder} tidak ditemukan, skip...`);
                continue;
            }

            console.log(`\n📁 Migrasi folder: ${migration.localFolder} → bucket: ${migration.bucket}`);

            const files = fs.readdirSync(folderPath).filter(f => {
                const ext = path.extname(f).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            });

            if (files.length === 0) {
                console.log(`   Tidak ada gambar ditemukan`);
                continue;
            }

            console.log(`   Ditemukan ${files.length} gambar\n`);

            for (const fileName of files) {
                const filePath = path.join(folderPath, fileName);

                try {
                    // Upload ke Supabase
                    const publicUrl = await uploadToSupabase(
                        migration.bucket,
                        fileName,
                        filePath
                    );

                    console.log(`   ✅ ${fileName}`);
                    console.log(`      → ${publicUrl}`);

                    // Update database
                    await updateDatabaseUrls(
                        client,
                        migration.table,
                        migration.urlColumn,
                        fileName,
                        publicUrl
                    );

                    results.uploaded++;
                } catch (error) {
                    console.log(`   ❌ ${fileName}: ${error.message}`);
                    results.failed++;
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Hasil Migrasi:');
        console.log(`   ✅ Berhasil: ${results.uploaded}`);
        console.log(`   ❌ Gagal: ${results.failed}`);
        console.log(`   ⏭️  Skip: ${results.skipped}`);
        console.log('='.repeat(60));

        if (results.uploaded > 0) {
            console.log('\n🎉 Migrasi selesai! Gambar sekarang tersimpan di Supabase Storage.');
            console.log('   URL di database sudah diupdate ke URL Supabase.');
        }

    } finally {
        client.release();
        await pool.end();
    }
}

migrateImages().catch(console.error);
