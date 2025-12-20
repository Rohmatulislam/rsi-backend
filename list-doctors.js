
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const doctors = await prisma.doctor.findMany({
            select: { id: true, name: true, kd_dokter: true }
        });
        console.log('DOCTORS_START');
        console.log(JSON.stringify(doctors, null, 2));
        console.log('DOCTORS_END');
    } catch (err) {
        console.error('Error fetching doctors:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
