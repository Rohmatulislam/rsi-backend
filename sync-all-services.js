const { Pool } = require('pg');
const knex = require('knex');
require('dotenv/config');

// Configs
const DATABASE_URL = process.env.DATABASE_URL;
const KHANZA_DB = {
    host: '192.168.10.2',
    port: 3306,
    user: process.env.KHANZA_DB_USER || 'sitihajar',
    password: process.env.KHANZA_DB_PASSWORD || 'timit007',
    database: process.env.KHANZA_DB_NAME || 'sik_rsi',
};

const pgPool = new Pool({ connectionString: DATABASE_URL });
const khanzaDb = knex({
    client: 'mysql2',
    connection: {
        ...KHANZA_DB,
        connectTimeout: 60000,
    }
});

async function syncAllServices() {
    console.log('🚀 Starting Comprehensive Service Data Sync...\n');
    const client = await pgPool.connect();

    try {
        // 0. Preliminary Check - Get All Service Slugs
        const servicesRes = await client.query('SELECT id, slug, name FROM "Service"');
        const services = servicesRes.rows;
        console.log(`📊 Found ${services.length} services in application database.`);

        // 1. CLEAR ALL SERVICE ITEMS (START FRESH)
        console.log('\n🧹 Clearing all existing ServiceItems...');
        await client.query('DELETE FROM "ServiceItem"');
        console.log('   ✅ All items cleared.');

        // Helper to insert item
        const insertItem = async (serviceId, category, name, desc, icon = 'Activity', order = 0) => {
            await client.query(`
                INSERT INTO "ServiceItem" (id, "serviceId", category, name, description, icon, "isActive", "order", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, $6, NOW(), NOW())
            `, [serviceId, category, name, desc, icon, order]);
        };

        // 2. RAWAT JALAN & POLI EKSEKUTIF
        const rawatJalan = services.find(s => s.slug === 'rawat-jalan');
        const poliExecutive = services.find(s => s.slug === 'poli-executive');

        if (rawatJalan || poliExecutive) {
            console.log('\n🏥 Processing Polikliniks from SIMRS...');
            const polis = await khanzaDb('poliklinik').where('status', '1');

            let rjCount = 0;
            let execCount = 0;

            for (const p of polis) {
                if (p.nm_poli === '-' || p.nm_poli.includes('IGD') || p.nm_poli.includes('UGD')) continue;

                const name = p.nm_poli;
                const isExec = name.toLowerCase().includes('eksekutif') ||
                    name.toLowerCase().includes('ekskutif') ||
                    name.toLowerCase().includes('vip') ||
                    name.toLowerCase().includes('executive');

                if (isExec && poliExecutive) {
                    const displayName = name.replace('Ekskutif', 'Eksekutif');
                    await insertItem(poliExecutive.id, 'EXECUTIVE', displayName, `Layanan premium ${displayName} dengan fasilitas eksklusif.`, 'Crown', execCount++);
                } else if (!isExec && rawatJalan) {
                    await insertItem(rawatJalan.id, 'POLIKLINIK', name, `Layanan spesialis ${name} dengan dokter berpengalaman.`, 'Stethoscope', rjCount++);
                }
            }
            console.log(`   ✅ Seeded ${rjCount} Rawat Jalan clinics.`);
            console.log(`   ✅ Seeded ${execCount} Poli Eksekutif clinics.`);
        }

        // 3. RAWAT INAP
        const rawatInap = services.find(s => s.slug === 'rawat-inap');
        if (rawatInap) {
            console.log('\n🛌 Processing Inpatient Buildings & Classes...');
            const roomClasses = await khanzaDb('kamar as k')
                .join('bangsal as b', 'k.kd_bangsal', 'b.kd_bangsal')
                .distinct('b.nm_bangsal', 'k.kelas')
                .where('b.status', '1')
                .where('k.statusdata', '1')
                .orderBy(['b.nm_bangsal', 'k.kelas']);

            let riCount = 0;
            for (const rc of roomClasses) {
                await insertItem(rawatInap.id, rc.nm_bangsal, rc.kelas, `Layanan rawat inap ${rc.kelas} di ${rc.nm_bangsal}.`, 'Building2', riCount++);
            }
            console.log(`   ✅ Seeded ${riCount} Building/Class combinations.`);
        }

        // Helper to normalize and deduplicate names
        const getUniqueNormalizedNames = (names) => {
            const normalized = names.map(n => {
                let text = n.trim().toUpperCase();

                // Fix common typos in source data
                text = text.replace(/ANTHEBRACHI/g, 'ANTEBRACHI');

                // Standardize common terms
                text = text.replace(/CATUR WARGA/g, 'CW');
                text = text.replace(/LATERAL/g, 'LAT');

                // Normalize punctuation and spaces
                text = text.replace(/ - /g, '/') // "A - B" -> "A/B"
                    .replace(/-/g, '/')       // "A-B" -> "A/B"
                    .replace(/\s*\/\s*/g, '/') // "A / B" -> "A/B"
                    .replace(/\s+/g, ' ')      // Collapse spaces
                    .trim();

                return text;
            });
            return [...new Set(normalized)].sort();
        };

        // 4. LABORATORIUM
        const labService = services.find(s => s.slug === 'laboratorium');
        if (labService) {
            console.log('\n🧪 Processing Laboratory Tests...');
            const labs = await khanzaDb('jns_perawatan_lab')
                .select('nm_perawatan')
                .where('status', '1');

            const uniqueLabs = getUniqueNormalizedNames(labs.map(l => l.nm_perawatan));

            let labCount = 0;
            for (const name of uniqueLabs) {
                await insertItem(labService.id, 'LAB', name, `Pemeriksaan laboratorium: ${name}.`, 'FlaskConical', labCount++);
            }
            console.log(`   ✅ Seeded ${labCount} unique Laboratory tests.`);
        }

        // 5. RADIOLOGI
        const radioService = services.find(s => s.slug === 'radiologi');
        if (radioService) {
            console.log('\n🩻 Processing Radiology Tests...');
            const radios = await khanzaDb('jns_perawatan_radiologi')
                .select('nm_perawatan')
                .where('status', '1');

            const uniqueRadios = getUniqueNormalizedNames(radios.map(r => r.nm_perawatan));

            let radCount = 0;
            for (const name of uniqueRadios) {
                await insertItem(radioService.id, 'RADIO', name, `Pemeriksaan radiologi: ${name}.`, 'Radio', radCount++);
            }
            console.log(`   ✅ Seeded ${radCount} unique Radiology tests.`);
        }

        // 6. MCU
        const mcuService = services.find(s => s.slug === 'mcu');
        if (mcuService) {
            console.log('\n📋 Processing MCU Packages (Static Fallback)...');
            const mcuPackages = [
                { name: 'Paket Basic', desc: 'Pemeriksaan dasar meliputi fisik, darah rutin, dan urin rutin.' },
                { name: 'Paket Executive Pria', desc: 'Pemeriksaan menyeluruh untuk pria meliputi jantung, fungsi hati, dan ginjal.' },
                { name: 'Paket Executive Wanita', desc: 'Pemeriksaan menyeluruh untuk wanita termasuk skrining kanker rahim.' },
                { name: 'Paket Pre-Wedding', desc: 'Skrining kesehatan untuk pasangan sebelum menikah.' },
                { name: 'Paket Jantung', desc: 'Fokus pada kesehatan jantung (EKG, Treadmill, Kolesterol).' }
            ];

            let mcuCount = 0;
            for (const p of mcuPackages) {
                await insertItem(mcuService.id, 'PAKET MCU', p.name, p.desc, 'ClipboardCheck', mcuCount++);
            }
            console.log(`   ✅ Seeded ${mcuCount} MCU packages.`);
        }

        // 7. FARMASI
        const farmasiService = services.find(s => s.slug === 'farmasi');
        if (farmasiService) {
            console.log('\n💊 Processing Pharmacy Items...');
            const farmasiItems = [
                { name: 'Apotek 24 Jam', desc: 'Layanan penebusan resep dan pembelian obat bebas 24 jam.' },
                { name: 'Layanan Antar Obat', desc: 'Fasilitas pengiriman obat ke rumah pasien (Home Delivery).' },
                { name: 'Konseling Obat', desc: 'Edukasi penggunaan obat oleh Apoteker berpengalaman.' }
            ];
            let fCount = 0;
            for (const item of farmasiItems) {
                await insertItem(farmasiService.id, 'FARMASI', item.name, item.desc, 'Pill', fCount++);
            }
            console.log(`   ✅ Seeded ${fCount} Pharmacy items.`);
        }

        // 8. REHABILITASI MEDIK
        const rehabService = services.find(s => s.slug === 'rehabilitasi-medik');
        if (rehabService) {
            console.log('\n🧘 Processing Rehab Medik Items...');
            const rehabItems = [
                { name: 'Fisioterapi', desc: 'Pemulihan gangguan gerak dan fungsi tubuh.' },
                { name: 'Terapi Okupasi', desc: 'Latihan aktivitas harian untuk kemandirian pasien.' },
                { name: 'Terapi Wicara', desc: 'Pemulihan gangguan bicara, bahasa, dan menelan.' },
                { name: 'Fisioterapi Anak (Pediatrik)', desc: 'Layanan fisioterapi khusus untuk tumbuh kembang anak.' }
            ];
            let rCount = 0;
            for (const item of rehabItems) {
                await insertItem(rehabService.id, 'REHAB', item.name, item.desc, 'Heart', rCount++);
            }
            console.log(`   ✅ Seeded ${rCount} Rehab Medik items.`);
        }

        console.log('\n🎉 ALL SERVICES SYNCED SUCCESSFULLY!');

    } catch (err) {
        console.error('\n❌ CRITICAL ERROR DURING SYNC:', err.message);
    } finally {
        client.release();
        await pgPool.end();
        await khanzaDb.destroy();
    }
}

syncAllServices();
