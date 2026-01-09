const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const notifs = await prisma.notification.findMany({
        where: { type: 'DOCTOR_LEAVE_NOTICE' },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log('--- NOTIFICATIONS ---');
    console.log(JSON.stringify(notifs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
