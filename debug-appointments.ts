import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching last 5 appointments...');
    const appointments = await prisma.appointment.findMany({
        take: 5,
        orderBy: {
            createdAt: 'desc'
        },
        select: {
            id: true,
            patientName: true,
            createdByUserId: true,
            createdAt: true,
            status: true
        }
    });

    console.log('Appointments:', JSON.stringify(appointments, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
