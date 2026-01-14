
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const buildings = await prisma.building.findMany();
    console.log('--- BUILDINGS (BANGSAL) ---');
    console.log(JSON.stringify(buildings, null, 2));

    const inpatientService = await prisma.service.findUnique({
        where: { slug: 'rawat-inap' },
        include: { items: true }
    });
    console.log('--- SERVICE: RAWAT INAP ---');
    console.log(JSON.stringify(inpatientService, null, 2));

    const excluded = await prisma.excludedBed.findMany();
    console.log('--- EXCLUDED BEDS ---');
    console.log(JSON.stringify(excluded, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
