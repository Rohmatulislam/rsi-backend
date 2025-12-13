import { PrismaClient } from '@prisma/client';
import knex, { Knex } from 'knex';
import 'dotenv/config';

// Create Khanza database connection
const khanzaDb: Knex = knex({
  client: 'mysql2',
  connection: {
    host: process.env.KHANZA_DB_HOST || 'localhost',
    port: parseInt(process.env.KHANZA_DB_PORT || '3306'),
    user: process.env.KHANZA_DB_USER || 'root',
    password: process.env.KHANZA_DB_PASSWORD || '',
    database: process.env.KHANZA_DB_NAME || 'sik',
  },
  pool: { min: 0, max: 7 },
});

const prisma = new PrismaClient();

async function syncDoctorKdDokter() {
  console.log('Memulai sinkronisasi kode dokter dari Khanza SIMRS...');

  try {
    // Test connection to Khanza
    await khanzaDb.raw('SELECT 1');
    console.log('✅ Terhubung ke database Khanza SIMRS');

    // Get all doctors from Khanza SIMRS
    const khanzaDoctors = await khanzaDb('dokter')
      .select('kd_dokter', 'nm_dokter', 'no_telp', 'kd_sps')
      .where('status', '1');

    console.log(`✅ Ditemukan ${khanzaDoctors.length} dokter dari Khanza SIMRS`);

    // Process each doctor from Khanza
    for (const khanzaDoctor of khanzaDoctors) {
      try {
        // Find doctor in our database using name similarity
        const ourDoctor = await prisma.doctor.findFirst({
          where: {
            name: khanzaDoctor.nm_dokter.trim()
          }
        });

        if (ourDoctor) {
          // Update our doctor with the Khanza code
          const updatedDoctor = await prisma.doctor.update({
            where: { id: ourDoctor.id },
            data: {
              kd_dokter: khanzaDoctor.kd_dokter,
              phone: khanzaDoctor.no_telp || ourDoctor.phone
            }
          });

          console.log(`✅ Kode dokter diperbarui: ${updatedDoctor.name} - ${updatedDoctor.kd_dokter}`);
        } else {
          // Try to find by partial name match (in case there are slight differences)
          const nameParts = khanzaDoctor.nm_dokter.trim().split(' ');
          const firstName = nameParts[0];
          
          const similarDoctor = await prisma.doctor.findFirst({
            where: {
              name: {
                contains: firstName
              }
            }
          });

          if (similarDoctor) {
            const updatedDoctor = await prisma.doctor.update({
              where: { id: similarDoctor.id },
              data: {
                kd_dokter: khanzaDoctor.kd_dokter,
                phone: khanzaDoctor.no_telp || similarDoctor.phone
              }
            });

            console.log(`✅ Kode dokter diperbarui (dengan pencocokan nama): ${updatedDoctor.name} - ${updatedDoctor.kd_dokter}`);
          } else {
            console.log(`⚠️ Dokter tidak ditemukan di database kita: ${khanzaDoctor.nm_dokter} (${khanzaDoctor.kd_dokter})`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error saat memperbarui dokter ${khanzaDoctor.nm_dokter}:`, error.message);
      }
    }

    console.log('Sinkronisasi kode dokter selesai.');
  } catch (error) {
    console.error('❌ Error saat sinkronisasi kode dokter:', error);
    throw error;
  } finally {
    await khanzaDb.destroy();
    await prisma.$disconnect();
  }
}

// Run the sync function
syncDoctorKdDokter()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });