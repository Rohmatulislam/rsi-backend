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
        const services = await prisma.service.findMany({
            include: {
                _count: {
                    select: { items: true }
                }
            }
        });

        console.table(services.map(s => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            items: s._count.items
        })));

        const rawatInapItems = await prisma.serviceItem.findMany({
            where: {
                OR: [
                    { category: { contains: 'Gedung', mode: 'insensitive' } },
                    { category: { contains: 'Kamar', mode: 'insensitive' } },
                    { name: { contains: 'Kelas', mode: 'insensitive' } },
                    { name: { contains: 'VIP', mode: 'insensitive' } },
                    { name: { contains: 'VVIP', mode: 'insensitive' } }
                ]
            },
            include: {
                service: true
            }
        });

        console.log('\nPotential Rawat Inap Items:');
        console.table(rawatInapItems.map(i => ({
            id: i.id,
            name: i.name,
            category: i.category,
            service: i.service?.slug,
            isActive: i.isActive
        })));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

run();
