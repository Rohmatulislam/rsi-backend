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
        const service = await prisma.service.findUnique({
            where: { slug: 'rawat-inap' },
            include: {
                items: true
            }
        });

        if (!service) {
            console.log('Service NOT FOUND');
            return;
        }

        console.log('Service:', service.name, 'Slug:', service.slug);
        console.log('Items Count:', service.items.length);
        console.table(service.items.map(i => ({
            id: i.id,
            name: i.name,
            category: i.category,
            isActive: i.isActive
        })));

        const activeItems = service.items.filter(i => i.isActive);
        console.log('Active Items Count:', activeItems.length);

        const categories = [...new Set(activeItems.map(i => i.category || 'Umum'))];
        console.log('Unique Categories (Buildings):', categories);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

run();
