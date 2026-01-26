import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const service = await prisma.service.findUnique({
            where: { slug: 'farmasi' }
        });
        console.log('Farmasi Service:', JSON.stringify(service, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
