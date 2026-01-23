import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const doctors = await prisma.doctor.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            kd_dokter: true,
            bio: true,
            description: true,
            specialization: true,
        },
        take: 10,
    });

    console.log(JSON.stringify(doctors, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
