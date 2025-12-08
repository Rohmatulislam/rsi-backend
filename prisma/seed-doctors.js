// Seed script for doctors data
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rsidb'
});

const doctors = [
  { name: 'dr. Era Damayanti', specialty: 'Rehabilitasi Medik', email: 'era.damayanti@rsi.com', phone: '081234567890', licenseNumber: 'SIP001', slug: 'dr-era-damayanti', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Dewi Radiologi', specialty: 'Radiologi', email: 'dewi.radiologi@rsi.com', phone: '081234567891', licenseNumber: 'SIP002', slug: 'dr-dewi-radiologi', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Salim S', specialty: 'Paru-Paru', email: 'salim.s@rsi.com', phone: '081234567892', licenseNumber: 'SIP003', slug: 'dr-salim-s-thalib-sppd', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'Dr. dr. Herpan', specialty: 'Saraf', email: 'herpan@rsi.com', phone: '081234567893', licenseNumber: 'SIP004', slug: 'dr-herpan-syafii-hasan', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Yogi Jantung', specialty: 'Jantung', email: 'yogi.jantung@rsi.com', phone: '081234567894', licenseNumber: 'SIP005', slug: 'dr-yogi-jantung', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Iga Diah Jiwa', specialty: 'Jiwa', email: 'iga.diah@rsi.com', phone: '081234567895', licenseNumber: 'SIP006', slug: 'dr-iga-diah-kumaratih', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. H. Nanang', specialty: 'Bedah Umum', email: 'nanang@rsi.com', phone: '081234567896', licenseNumber: 'SIP007', slug: 'dr-h-nanang-widodo', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Rina Lestari', specialty: 'Paru-Paru', email: 'rina.lestari@rsi.com', phone: '081234567897', licenseNumber: 'SIP008', slug: 'dr-rina-lestari-sppk', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Gustin Fatah', specialty: 'Rehabilitasi Medik', email: 'gustin.fatah@rsi.com', phone: '081234567898', licenseNumber: 'SIP009', slug: 'dr-gustin-fataah-mulyadi', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. I Wayan', specialty: 'Saraf', email: 'wayan@rsi.com', phone: '081234567899', licenseNumber: 'SIP010', slug: 'dr-i-wayan-subagiartha', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Aria Danurdoro', specialty: 'Urologi', email: 'aria.danurdoro@rsi.com', phone: '081234567900', licenseNumber: 'SIP011', slug: 'dr-aria-danurdoro-sp-u', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Nusantara', specialty: 'Radiologi', email: 'nusantara@rsi.com', phone: '081234567901', licenseNumber: 'SIP012', slug: 'dr-nusantara-sprad-subagus', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Bayu S', specialty: 'Jantung', email: 'bayu.s@rsi.com', phone: '081234567902', licenseNumber: 'SIP013', slug: 'dr-bayu-setia-m-biomed', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Made Sujaya', specialty: 'Penyakit Dalam', email: 'made.sujaya@rsi.com', phone: '081234567903', licenseNumber: 'SIP014', slug: 'dr-made-sujaya-sppd', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Didit Yudhanto', specialty: 'THT', email: 'didit.yudhanto@rsi.com', phone: '081234567904', licenseNumber: 'SIP015', slug: 'dr-didit-yudhanto-sp-tht', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. H. Pebrian', specialty: 'Urologi', email: 'pebrian@rsi.com', phone: '081234567905', licenseNumber: 'SIP016', slug: 'dr-h-pebrian-jauhari', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Ario D', specialty: 'Kandungan', email: 'ario.d@rsi.com', phone: '081234567906', licenseNumber: 'SIP017', slug: 'dr-ario-d-spog-subsp-re', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Wahyu', specialty: 'Bedah', email: 'wahyu@rsi.com', phone: '081234567907', licenseNumber: 'SIP018', slug: 'dr-wahyu-bedah-chalim', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Santyo', specialty: 'Bedah', email: 'santyo@rsi.com', phone: '081234567908', licenseNumber: 'SIP019', slug: 'dr-santyo-wibowo-sp-b', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Dewi C', specialty: 'Kulit & Kelamin', email: 'dewi.c@rsi.com', phone: '081234567909', licenseNumber: 'SIP020', slug: 'dr-dewi-gotama-spdv', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. M. Fariska', specialty: 'Bedah', email: 'm.fariska@rsi.com', phone: '081234567910', licenseNumber: 'SIP021', slug: 'dr-m-fariska-firdaus', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Ancella', specialty: 'Kulit & Kelamin', email: 'ancella@rsi.com', phone: '081234567911', licenseNumber: 'SIP022', slug: 'dr-ancella-soenardy-spdv', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. I Gede', specialty: 'Mata', email: 'gede@rsi.com', phone: '081234567912', licenseNumber: 'SIP023', slug: 'dr-i-gede-suparta-sp-m', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Ida Ayu', specialty: 'Penyakit Dalam', email: 'ida.ayu@rsi.com', phone: '081234567913', licenseNumber: 'SIP024', slug: 'dr-ida-ayu-nanda-d-sppd', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Sunardi', specialty: 'Bedah', email: 'sunardi@rsi.com', phone: '081234567914', licenseNumber: 'SIP025', slug: 'dr-sunardi-spba-mhkes', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Alisza I', specialty: 'Kandungan', email: 'alisza@rsi.com', phone: '081234567915', licenseNumber: 'SIP026', slug: 'dr-alisza-r-alisza', consultation_fee: 160000, is_executive: false, bpjs: true },
  { name: 'drg. Ni Made', specialty: 'Gigi & Mulut', email: 'nimade@rsi.com', phone: '081234567916', licenseNumber: 'SIP027', slug: 'drg-ni-made-ambary', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Putu Anisya', specialty: 'Penyakit Dalam', email: 'putu.anisya@rsi.com', phone: '081234567917', licenseNumber: 'SIP028', slug: 'dr-putu-anisya-sppd', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Hj. Indri', specialty: 'Anak', email: 'indri@rsi.com', phone: '081234567918', licenseNumber: 'SIP029', slug: 'dr-hj-indri-hasasri-m-spa', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Kristopher', specialty: 'Anak', email: 'kristopher@rsi.com', phone: '081234567919', licenseNumber: 'SIP030', slug: 'dr-kristopher-may-p-spa', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Danang Jiwa', specialty: 'Jiwa', email: 'danang.jiwa@rsi.com', phone: '081234567920', licenseNumber: 'SIP031', slug: 'dr-danang-nur-a-sp-kj', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'Dr. dr. H. Taufik', specialty: 'Orthopedi', email: 'taufik@rsi.com', phone: '081234567921', licenseNumber: 'SIP032', slug: 'dr-dr-h-af-taufik', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. M. Sofyan', specialty: 'Saraf', email: 'sofyan@rsi.com', phone: '081234567922', licenseNumber: 'SIP033', slug: 'dr-m-sofyan-faridi-sp-s', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Faradika', specialty: 'Penyakit Dalam', email: 'faradika@rsi.com', phone: '081234567923', licenseNumber: 'SIP034', slug: 'dr-faradika-neta-hb', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. Philip Habib', specialty: 'Penyakit Dalam', email: 'philip@rsi.com', phone: '081234567924', licenseNumber: 'SIP035', slug: 'dr-philip-habib-sppd', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Catarina', specialty: 'Penyakit Dalam', email: 'catarina@rsi.com', phone: '081234567925', licenseNumber: 'SIP036', slug: 'dr-catarina-budyono', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'dr. H. Arif', specialty: 'Bedah', email: 'arif@rsi.com', phone: '081234567926', licenseNumber: 'SIP037', slug: 'dr-h-arif-zuhan-spb-kv', consultation_fee: 160000, is_executive: true, bpjs: true },
  { name: 'drg. Eka Gigi', specialty: 'Gigi & Mulut', email: 'eka@rsi.com', phone: '081234567927', licenseNumber: 'SIP038', slug: 'drg-eka-gigi', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. I Putu Mata', specialty: 'Mata', email: 'putu.mata@rsi.com', phone: '081234567928', licenseNumber: 'SIP039', slug: 'dr-i-putu-gede-yudi-sp-m', consultation_fee: 160000, is_executive: false, bpjs: false },
  { name: 'dr. Larangga', specialty: 'Penyakit Dalam', email: 'larangga@rsi.com', phone: '081234567929', licenseNumber: 'SIP040', slug: 'dr-larangga-gempa-k-sppd', consultation_fee: 160000, is_executive: false, bpjs: false },
];

async function seedDoctors() {
  console.log('🌱 Starting doctor seed...');
  
  try {
    for (const doc of doctors) {
      await pool.query(
        `INSERT INTO "Doctor" (
          id, name, email, phone, specialization, "licenseNumber", slug, 
          consultation_fee, is_executive, bpjs, "isActive", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW()
        )
        ON CONFLICT ("licenseNumber") DO NOTHING`,
        [
          doc.name, doc.email, doc.phone, doc.specialty, doc.licenseNumber, 
          doc.slug, doc.consultation_fee, doc.is_executive, doc.bpjs
        ]
      );
    }
    
    console.log(`✅ Successfully seeded ${doctors.length} doctors!`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDoctors();
