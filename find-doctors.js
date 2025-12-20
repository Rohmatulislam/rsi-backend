const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
});

async function run() {
    try {
        const lab = await prisma.doctor.findMany({
            where: {
                OR: [
                    { name: { contains: 'Lab', mode: 'insensitive' } },
                    { specialization: { contains: 'Lab', mode: 'insensitive' } }
                ]
            }
        });
        console.log('Doctor Lab Count:', lab.length);
        if (lab.length > 0) console.log('Doctor Lab:', lab);

        const rad = await prisma.doctor.findMany({
            where: {
                OR: [
                    { name: { contains: 'Radiologi', mode: 'insensitive' } },
                    { specialization: { contains: 'Radiologi', mode: 'insensitive' } }
                ]
            }
        });
        console.log('Doctor Rad Count:', rad.length);
        if (rad.length > 0) console.log('Doctor Rad (sample):', rad.slice(0, 1));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

run();
