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
        const pk = await prisma.doctor.findMany({
            where: {
                OR: [
                    { name: { contains: 'Sp.PK', mode: 'insensitive' } },
                    { specialization: { contains: 'Patologi', mode: 'insensitive' } }
                ]
            }
        });
        console.log('Doctor PK:', pk);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

run();
