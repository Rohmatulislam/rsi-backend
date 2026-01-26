
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- SERVICE ITEMS ---');
    const items = await prisma.serviceItem.findMany({
        select: { id: true, name: true }
    });
    console.log(JSON.stringify(items, null, 2));

    console.log('\n--- CATEGORIES ---');
    const categories = await prisma.category.findMany({
        where: { type: 'POLI' },
        select: { id: true, name: true, slug: true }
    });
    console.log(JSON.stringify(categories, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
