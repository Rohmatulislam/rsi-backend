import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const service = await prisma.service.findUnique({
            where: { slug: 'mcu' },
            include: { items: true }
        });
        console.log(JSON.stringify(service, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
