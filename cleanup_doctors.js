const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Cleaning up invalid doctors (kd_dokter is NULL)...');

    // First, check how many
    const count = await prisma.doctor.count({ where: { kd_dokter: null } });
    console.log(`Found ${count} invalid doctors.`);

    if (count > 0) {
        // Delete them
        const result = await prisma.doctor.deleteMany({
            where: { kd_dokter: null }
        });
        console.log(`Deleted ${result.count} doctors.`);
    } else {
        console.log('No cleanup needed.');
    }

    const remaining = await prisma.doctor.count();
    console.log(`Remaining valid doctors: ${remaining}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
