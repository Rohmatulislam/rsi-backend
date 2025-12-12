const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Checking for duplicates of "Dewi Roziqo"...');
    const docs = await prisma.doctor.findMany({
        where: { name: { contains: 'Dewi Roziqo' } }
    });
    console.log(docs.map(d => ({ id: d.id, name: d.name, kd_dokter: d.kd_dokter })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
