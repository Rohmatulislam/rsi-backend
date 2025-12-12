const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Checking for duplicates of "Era"...');
    const eras = await prisma.doctor.findMany({
        where: { name: { contains: 'Era' } }
    });
    console.log(eras);

    console.log('---');
    console.log('Counting total doctors:', await prisma.doctor.count());
    console.log('Doctors with kd_dokter=null:', await prisma.doctor.count({ where: { kd_dokter: null } }));
    console.log('Doctors with kd_dokter!=null:', await prisma.doctor.count({ where: { NOT: { kd_dokter: null } } }));
}

main().catch(console.error).finally(() => prisma.$disconnect());
